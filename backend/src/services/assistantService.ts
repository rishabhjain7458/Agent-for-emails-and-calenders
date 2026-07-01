import { classifyIntent, answerGeneralQuestion, generateEmailSummary, extractAssistantParameters } from './geminiService.js';
import { createEvent, createEventForConnectedAccount, deleteEvent, listEvents, listEventsForConnectedAccount } from './calendarService.js';
import { createMicrosoftEvent, createMicrosoftEventForConnectedAccount, listMicrosoftEvents, listMicrosoftEventsForConnectedAccount } from './microsoftCalendarService.js';
import { listEmails, listEmailsForConnectedAccount } from './emailService.js';
import { listMicrosoftEmails, listMicrosoftEmailsForConnectedAccount } from './microsoftEmailService.js';
import { listZohoEmails, listZohoEmailsForConnectedAccount } from './zohoEmailService.js';
import { listImapEmailsForConnectedAccount } from './imapEmailService.js';
import { createTask, listTasks } from '../repositories/taskRepository.js';
import { createGoogleTask, createGoogleTaskForConnectedAccount } from './googleTasksService.js';
import { createMicrosoftTask, createMicrosoftTaskForConnectedAccount } from './microsoftTasksService.js';
import { getSettings } from '../repositories/settingsRepository.js';
import type { AuthUser, EmailMessage } from '../types.js';
import { formatAccountChoicePrompt, listAccountContexts, resolveAccountSelection, resolveMentionedAccount, type AccountContext } from './accountContextService.js';
import { normalizeInboxQuery } from '../utils/emailQuery.js';
import { clarifyCalendarRequest, isCalendarInputValid, normalizeCalendarParams } from './assistantCalendarParams.js';
import { formatCalendarAgenda, formatConflict, formatCreatedMeeting, formatEmailSearch, formatEmailSummaryEmpty, formatTaskCreated, formatTaskList, preferredTimezone } from './assistantResponseFormatter.js';

type AssistantHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

async function searchEmails(user: AuthUser, query: string, account: AccountContext) {
  if (!account.isPrimary) {
    return account.provider === 'microsoft'
      ? listMicrosoftEmailsForConnectedAccount(user.tenantId, user.id, account.accountId, account.email, query)
      : account.provider === 'zoho'
        ? listZohoEmailsForConnectedAccount(user.tenantId, user.id, account.accountId, account.email, account.providerAccountId!, query)
      : account.provider === 'imap'
        ? listImapEmailsForConnectedAccount(user.tenantId, user.id, account.accountId, query)
      : listEmailsForConnectedAccount(user.tenantId, user.id, account.accountId, account.email, query);
  }

  const primary = await (user.provider === 'microsoft'
    ? listMicrosoftEmails(user.id, query)
    : user.provider === 'zoho'
      ? listZohoEmails(user.id, query)
    : listEmails(user.id, query));
  const primaryMessages = primary.messages.map((message: EmailMessage) => ({
    ...message,
    accountEmail: user.email,
    provider: user.provider
  }));
  return { ...primary, messages: primaryMessages };
}

async function searchEmailsAcrossAccounts(user: AuthUser, query: string, accounts: AccountContext[]) {
  const results = await Promise.all(accounts.map((account) => searchEmails(user, query, account)));
  return results.flatMap((result) => result.messages);
}

function findPendingAccountRequest(history: AssistantHistoryMessage[] = []) {
  const lastAssistantIndex = [...history].reverse().findIndex((entry) => entry.role === 'assistant');
  if (lastAssistantIndex < 0) return null;

  const assistantIndex = history.length - 1 - lastAssistantIndex;
  const assistantMessage = history[assistantIndex];
  if (!/^Which account should I use for /i.test(assistantMessage.content)) return null;

  for (let index = assistantIndex - 1; index >= 0; index -= 1) {
    if (history[index].role === 'user') return history[index].content;
  }

  return null;
}

function lastAssistantIndex(history: AssistantHistoryMessage[] = []) {
  const reversedIndex = [...history].reverse().findIndex((entry) => entry.role === 'assistant');
  return reversedIndex < 0 ? -1 : history.length - 1 - reversedIndex;
}

function findUserBefore(history: AssistantHistoryMessage[], index: number) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (history[cursor].role === 'user') return { index: cursor, content: history[cursor].content };
  }
  return null;
}

function findPendingClarification(history: AssistantHistoryMessage[] = []) {
  const assistantIndex = lastAssistantIndex(history);
  if (assistantIndex < 0) return null;

  const assistantMessage = history[assistantIndex];
  if (!/^I need one more detail before I can create that meeting\./i.test(assistantMessage.content)) return null;

  const userBeforeClarification = findUserBefore(history, assistantIndex);
  if (!userBeforeClarification) return null;

  const accountPromptIndex = history
    .slice(0, assistantIndex)
    .map((entry, index) => ({ entry, index }))
    .reverse()
    .find(({ entry }) => entry.role === 'assistant' && /^Which account should I use for /i.test(entry.content))?.index;

  if (accountPromptIndex === undefined) {
    return { originalRequest: userBeforeClarification.content, accountSelection: null as string | null };
  }

  const originalRequest = findUserBefore(history, accountPromptIndex)?.content ?? userBeforeClarification.content;
  const accountSelection = history
    .slice(accountPromptIndex + 1, assistantIndex)
    .find((entry) => entry.role === 'user')?.content ?? null;

  return { originalRequest, accountSelection };
}

function isStandaloneRequest(message: string) {
  return /\b(create|schedule|meeting|calendar|task|email|summari[sz]e|show|list|find)\b/i.test(message);
}

async function listCalendarForAccount(user: AuthUser, account: AccountContext, params: any) {
  if (account.provider === 'zoho' || account.provider === 'imap') return [];
  if (account.provider === 'microsoft') {
    return account.isPrimary
      ? listMicrosoftEvents(user.id, params.timeMin, params.timeMax)
      : listMicrosoftEventsForConnectedAccount(user.tenantId, user.id, account.accountId, account.email, params.timeMin, params.timeMax);
  }

  return account.isPrimary
    ? listEvents(user.id, params.timeMin, params.timeMax)
    : listEventsForConnectedAccount(user.tenantId, user.id, account.accountId, account.email, params.timeMin, params.timeMax);
}

async function resolveAssistantScope(user: AuthUser, accountId?: string | null) {
  if (!accountId) return { combined: false, account: undefined as AccountContext | undefined };
  const normalized = accountId.trim().toLowerCase();
  if (!normalized || normalized === 'combined' || normalized === 'all') {
    return { combined: true, account: undefined as AccountContext | undefined };
  }

  const accounts = await listAccountContexts(user);
  const account = accounts.find((candidate) => (
    candidate.accountId === accountId ||
    candidate.email.toLowerCase() === normalized ||
    (normalized === 'primary' && candidate.isPrimary)
  ));
  return { combined: false, account };
}

async function processAssistantMessage(user: AuthUser, message: string, forcedAccount?: AccountContext, combinedScope = false) {
  const tenantId = user.tenantId;
  const userId = user.id;
  const intent = await classifyIntent(tenantId, userId, message);
  const settings = await getSettings(tenantId, userId);
  const userTimezone = preferredTimezone(settings.timezone);
  const extracted = await extractAssistantParameters(tenantId, userId, intent, message, userTimezone);
  const params = { ...(intent.parameters as any), ...extracted };
  const accountIntents = ['calendar_create', 'calendar_check', 'calendar_delete', 'email_summary', 'email_search', 'task_create', 'task_list'];
  const accounts = accountIntents.includes(intent.intent) ? await listAccountContexts(user) : [];
  const selectedAccount = forcedAccount ?? (accounts.length ? await resolveMentionedAccount(user, message) : undefined);

  if (!forcedAccount && !combinedScope && accounts.length > 1 && !selectedAccount) {
    const action = intent.intent.startsWith('calendar')
      ? 'calendar'
      : intent.intent.startsWith('task')
        ? 'tasks'
        : 'email';
    return { intent, result: formatAccountChoicePrompt(accounts, action) };
  }
  const account = selectedAccount ?? accounts[0];

  switch (intent.intent) {
    case 'calendar_create': {
      if (account?.provider === 'zoho' || account?.provider === 'imap') {
        return { intent, result: 'Mail-only spaces do not support calendar creation yet. Please choose a Gmail or Outlook space for meetings.' };
      }
      const calendarParams = {
        ...normalizeCalendarParams(params, message, userTimezone),
        attendees: Array.isArray(params.attendees) ? params.attendees.filter((item: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)) : []
      };
      if (!isCalendarInputValid(calendarParams)) {
        return { intent, result: clarifyCalendarRequest(calendarParams) };
      }
      calendarParams.description = calendarParams.description || message;
      const created: any = account?.provider === 'microsoft'
        ? account.isPrimary
          ? await createMicrosoftEvent(userId, calendarParams)
          : await createMicrosoftEventForConnectedAccount(tenantId, userId, account.accountId, calendarParams)
        : account?.isPrimary === false
          ? await createEventForConnectedAccount(tenantId, userId, account.accountId, calendarParams)
          : await createEvent(userId, calendarParams, false);
      return {
        intent,
        result: created.requiresConfirmation ? formatConflict(calendarParams, created) : formatCreatedMeeting(calendarParams, created)
      };
    }
    case 'calendar_check':
      if (combinedScope) {
        const eventsByAccount = await Promise.all(accounts.filter((item) => item.provider !== 'zoho' && item.provider !== 'imap').map((item) => listCalendarForAccount(user, item, params)));
        return { intent, result: formatCalendarAgenda(eventsByAccount.flat(), params) };
      }
      if (account?.provider === 'zoho' || account?.provider === 'imap') {
        return { intent, result: 'Mail-only spaces do not support calendar lookup yet. Please choose a Gmail or Outlook space.' };
      }
      return { intent, result: formatCalendarAgenda(await listCalendarForAccount(user, account!, params), params) };
    case 'calendar_delete':
      await deleteEvent(userId, params.eventId);
      return { intent, result: 'Calendar event deleted.' };
    case 'email_search': {
      const query = normalizeInboxQuery(String(params.query ?? ''), message);
      if (combinedScope) {
        const messages = await searchEmailsAcrossAccounts(user, query, accounts);
        return { intent, result: formatEmailSearch(messages, query) };
      }
      const emails = await searchEmails(user, query, account!);
      return { intent, result: formatEmailSearch(emails.messages, query) };
    }
    case 'email_summary': {
      const query = normalizeInboxQuery(String(params.query ?? 'newer_than:14d'), message);
      if (combinedScope) {
        const messages = await searchEmailsAcrossAccounts(user, query, accounts);
        if (!messages.length) return { intent, result: formatEmailSummaryEmpty(query) };
        return { intent, result: await generateEmailSummary(tenantId, userId, messages) };
      }
      const emails = await searchEmails(user, query, account!);
      if (!emails.messages.length) return { intent, result: formatEmailSummaryEmpty(query) };
      return { intent, result: await generateEmailSummary(tenantId, userId, emails.messages) };
    }
    case 'task_create': {
      if (account?.provider === 'zoho' || account?.provider === 'imap') {
        return { intent, result: 'Mail-only spaces do not support task creation yet. Please choose a Gmail or Outlook space for tasks.' };
      }
      const title = params.title || message;
      const providerTask = account?.provider === 'microsoft'
        ? account.isPrimary
          ? await createMicrosoftTask(userId, title, params.dueDate)
          : await createMicrosoftTaskForConnectedAccount(tenantId, userId, account.accountId, title, params.dueDate)
        : account?.isPrimary === false
          ? await createGoogleTaskForConnectedAccount(tenantId, userId, account.accountId, title, params.dueDate)
          : await createGoogleTask(userId, title, params.dueDate);
      await createTask(tenantId, userId, title, params.dueDate, providerTask.id, {
        provider: account?.provider,
        accountId: account?.accountId,
        accountEmail: account?.email,
        taskListId: providerTask.taskListId ?? null
      });
      return {
        intent,
        result: formatTaskCreated(title, params.dueDate)
      };
    }
    case 'task_list':
      if (!combinedScope && (account?.provider === 'zoho' || account?.provider === 'imap')) {
        return { intent, result: 'Mail-only spaces do not support synced tasks yet. Please choose a Gmail or Outlook space.' };
      }
      return { intent, result: formatTaskList(await listTasks(tenantId, combinedScope ? undefined : account?.accountId)) };
    default:
      return { intent, result: await answerGeneralQuestion(tenantId, userId, message) };
  }
}

export async function handleAssistantMessage(user: AuthUser, message: string, history: AssistantHistoryMessage[] = [], accountId?: string | null) {
  const scope = await resolveAssistantScope(user, accountId);
  const pendingOriginalRequest = findPendingAccountRequest(history);
  if (pendingOriginalRequest) {
    if (scope.account || scope.combined) {
      return processAssistantMessage(user, pendingOriginalRequest, scope.account, scope.combined);
    }
    const accounts = await listAccountContexts(user);
    const selectedAccount = resolveAccountSelection(accounts, message);
    if (!selectedAccount) {
      return {
        intent: { intent: 'general_question' as const, confidence: 1, parameters: {} },
        result: formatAccountChoicePrompt(accounts, 'that request')
      };
    }
    return processAssistantMessage(user, pendingOriginalRequest, selectedAccount);
  }

  const pendingClarification = findPendingClarification(history);
  if (pendingClarification) {
    const accounts = await listAccountContexts(user);
    const selectedAccount = pendingClarification.accountSelection
      ? resolveAccountSelection(accounts, pendingClarification.accountSelection)
      : undefined;
    const resumedMessage = isStandaloneRequest(message)
      ? message
      : `${pendingClarification.originalRequest}\n${message}`;
    return processAssistantMessage(user, resumedMessage, scope.account ?? selectedAccount, scope.combined);
  }

  return processAssistantMessage(user, message, scope.account, scope.combined);
}
