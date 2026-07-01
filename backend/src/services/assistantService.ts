import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezonePlugin from 'dayjs/plugin/timezone.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
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

dayjs.extend(utc);
dayjs.extend(timezonePlugin);
dayjs.extend(customParseFormat);

const weekdayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function isCalendarInputValid(params: any) {
  if (!params?.title || !params?.date || !params?.startTime || !params?.endTime) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) return false;
  if (!/^\d{2}:\d{2}$/.test(params.startTime) || !/^\d{2}:\d{2}$/.test(params.endTime)) return false;
  const zone = params.timezone || 'UTC';
  const start = dayjs.tz(`${params.date} ${params.startTime}`, 'YYYY-MM-DD HH:mm', zone);
  const end = dayjs.tz(`${params.date} ${params.endTime}`, 'YYYY-MM-DD HH:mm', zone);
  return start.isValid() && end.isValid() && end.isAfter(start);
}

function fallbackCalendarTitle(message: string) {
  const withMatch = message.match(/\bwith\s+([^,.;\n]+?)(?:\s+(?:at|from|on|today|tomorrow|next|for|regarding)\b|$)/i);
  if (withMatch?.[1]?.trim()) return `Meeting with ${withMatch[1].trim()}`;

  const aboutMatch = message.match(/\b(?:about|regarding|for)\s+([^,.;\n]+)$/i);
  if (aboutMatch?.[1]?.trim()) return aboutMatch[1].trim();

  return 'Meeting';
}

function normalizeTimeToken(hourText?: string, minuteText?: string, meridiemText?: string) {
  if (!hourText) return null;
  let hour = Number(hourText);
  const minute = minuteText ? Number(minuteText) : 0;
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute > 59) return null;

  const meridiem = meridiemText?.toLowerCase();
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  if (!meridiem && hour >= 1 && hour <= 7) hour += 12;
  if (hour > 23) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function inferDateFromMessage(message: string, zone: string) {
  const text = message.toLowerCase();
  const now = dayjs().tz(zone);

  if (/\btomorrow\b/.test(text)) return now.add(1, 'day').format('YYYY-MM-DD');
  if (/\btoday\b/.test(text)) return now.format('YYYY-MM-DD');

  const nextWeekday = text.match(/\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
  if (nextWeekday?.[1]) {
    const target = weekdayNames.indexOf(nextWeekday[1].toLowerCase());
    const daysAhead = ((target - now.day() + 7) % 7) || 7;
    return now.add(daysAhead, 'day').format('YYYY-MM-DD');
  }

  const weekday = text.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
  if (weekday?.[1]) {
    const target = weekdayNames.indexOf(weekday[1].toLowerCase());
    const daysAhead = ((target - now.day() + 7) % 7) || 7;
    return now.add(daysAhead, 'day').format('YYYY-MM-DD');
  }

  const isoDate = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoDate?.[1]) return isoDate[1];

  const slashDate = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/);
  if (slashDate) {
    const year = slashDate[3] ?? String(now.year());
    const parsed = dayjs(`${year}-${slashDate[2]}-${slashDate[1]}`, 'YYYY-M-D', true);
    if (parsed.isValid()) return parsed.format('YYYY-MM-DD');
  }

  return null;
}

function inferTimeRangeFromMessage(message: string, zone: string, date?: string) {
  const compact = message.replace(/\./g, '').replace(/\s+/g, ' ');
  const timePattern = String.raw`(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|am|pm)?`;
  const range = compact.match(new RegExp(String.raw`\b(?:from\s+)?${timePattern}\s*(?:to|-|until|till)\s*${timePattern}`, 'i'));
  if (range) {
    const startMeridiem = range[3] || range[6];
    const startTime = normalizeTimeToken(range[1], range[2], startMeridiem?.replace(/\./g, ''));
    const endTime = normalizeTimeToken(range[4], range[5], range[6]?.replace(/\./g, ''));
    if (startTime && endTime) return { startTime, endTime };
  }

  const single = compact.match(new RegExp(String.raw`\b(?:at|around|by)?\s*${timePattern}\b`, 'i'));
  const startTime = normalizeTimeToken(single?.[1], single?.[2], single?.[3]?.replace(/\./g, ''));
  if (!startTime) return {};

  const duration = compact.match(/\bfor\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b/i);
  const minutes = duration
    ? (/h/i.test(duration[2]) ? Number(duration[1]) * 60 : Number(duration[1]))
    : 30;
  const end = dayjs.tz(`${date ?? dayjs().tz(zone).format('YYYY-MM-DD')} ${startTime}`, 'YYYY-MM-DD HH:mm', zone).add(minutes, 'minute');
  return { startTime, endTime: end.format('HH:mm') };
}

function normalizeCalendarParams(params: any, message: string, userTimezone: string) {
  const zone = params.timezone && params.timezone !== 'UTC' ? params.timezone : userTimezone;
  const date = params.date || inferDateFromMessage(message, zone);
  const inferredTimes = inferTimeRangeFromMessage(message, zone, date);
  const startTime = params.startTime || inferredTimes.startTime;
  const endTime = params.endTime || inferredTimes.endTime || (date && startTime
    ? dayjs.tz(`${date} ${startTime}`, 'YYYY-MM-DD HH:mm', zone).add(30, 'minute').format('HH:mm')
    : undefined);
  const missing = new Set(Array.isArray(params.missing) ? params.missing : []);
  if (date) missing.delete('date');
  if (startTime) missing.delete('startTime');
  if (endTime) missing.delete('endTime');
  missing.delete('timezone');
  if (params.title || fallbackCalendarTitle(message)) missing.delete('title');

  return {
    ...params,
    title: params.title || fallbackCalendarTitle(message),
    date,
    startTime,
    endTime,
    timezone: zone,
    missing: [...missing]
  };
}

function clarifyCalendarRequest(params: any) {
  const missing = Array.isArray(params?.missing) && params.missing.length
    ? params.missing.join(', ')
    : 'date, start time, or end time';
  return [
    'I need one more detail before I can create that meeting.',
    '',
    `Missing or unclear: ${missing}.`,
    '',
    'Please send it like: Create a meeting tomorrow from 2:00 PM to 3:00 PM about project discussion.'
  ].join('\n');
}

function preferredTimezone(value?: string | null) {
  return !value || value === 'UTC' ? 'Asia/Kolkata' : value;
}

function formatMeetingTime(params: any) {
  const zone = params.timezone || 'Asia/Kolkata';
  const start = dayjs.tz(`${params.date} ${params.startTime}`, 'YYYY-MM-DD HH:mm', zone);
  const end = dayjs.tz(`${params.date} ${params.endTime}`, 'YYYY-MM-DD HH:mm', zone);
  return `${start.format('ddd, D MMM YYYY')} from ${start.format('h:mm A')} to ${end.format('h:mm A')} (${zone})`;
}

function formatCreatedMeeting(params: any, result: any) {
  const link = result?.event?.htmlLink;
  return [
    'Meeting created.',
    '',
    `Title: ${params.title}`,
    `When: ${formatMeetingTime(params)}`,
    params.description ? `Notes: ${params.description}` : '',
    link ? `Calendar link: ${link}` : ''
  ].filter(Boolean).join('\n');
}

function formatConflict(params: any, result: any) {
  const suggestions = Array.isArray(result?.suggestions) && result.suggestions.length
    ? result.suggestions.map((slot: any) => `- ${dayjs(slot.start).format('D MMM, h:mm A')} to ${dayjs(slot.end).format('h:mm A')}`).join('\n')
    : '- No clear free slots were returned.';
  return [
    'I found a calendar conflict, so I did not create the meeting yet.',
    '',
    `Requested: ${formatMeetingTime(params)}`,
    '',
    'Suggested alternatives:',
    suggestions
  ].join('\n');
}

function formatDate(value?: string | null) {
  if (!value) return 'Date unavailable';
  const date = dayjs(value);
  return date.isValid() ? date.format('ddd, D MMM YYYY, h:mm A') : value;
}

function compactText(value?: string | null, limit = 180) {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1).trim()}...` : normalized;
}

function formatEmailSearch(emails: EmailMessage[], query: string) {
  if (!emails.length) {
    return [
      'No emails found.',
      '',
      `Search used: ${query}`
    ].join('\n');
  }

  const items = emails.slice(0, 10).flatMap((email, index) => [
    `Email ${index + 1}:`,
    `Subject: ${email.subject || '(No subject)'}`,
    email.accountEmail ? `Inbox: ${email.accountEmail}` : '',
    `From: ${email.sender || 'Unknown sender'}`,
    `Date: ${formatDate(email.date)}`,
    `Status: ${email.unread ? 'Unread' : 'Read'}`,
    email.snippet ? `Preview: ${compactText(email.snippet)}` : '',
    ''
  ]).filter((line, index, all) => line || all[index - 1]);

  return [
    `Found ${emails.length} email${emails.length === 1 ? '' : 's'}.`,
    '',
    `Search used: ${query}`,
    '',
    'Emails:',
    ...items
  ].join('\n').trim();
}

function formatTaskList(tasks: any[]) {
  const pending = tasks.filter((task) => task.status !== 'completed');
  if (!tasks.length) return 'No tasks found.';
  return [
    `You have ${pending.length} pending task${pending.length === 1 ? '' : 's'} out of ${tasks.length} total.`,
    '',
    'Pending tasks:',
    ...(pending.length ? pending.map((task, index) => `${index + 1}. ${task.title}${task.due_date ? `\nDue: ${formatDate(task.due_date)}` : ''}`) : ['- None']),
    '',
    'Completed tasks:',
    ...(tasks.filter((task) => task.status === 'completed').length
      ? tasks.filter((task) => task.status === 'completed').slice(0, 5).map((task, index) => `${index + 1}. ${task.title}`)
      : ['- None'])
  ].filter(Boolean).join('\n');
}

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
        return { intent, result: eventsByAccount.flat() };
      }
      if (account?.provider === 'zoho' || account?.provider === 'imap') {
        return { intent, result: 'Mail-only spaces do not support calendar lookup yet. Please choose a Gmail or Outlook space.' };
      }
      return { intent, result: await listCalendarForAccount(user, account!, params) };
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
        return { intent, result: await generateEmailSummary(tenantId, userId, messages) };
      }
      const emails = await searchEmails(user, query, account!);
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
        result: [
          'Task created.',
          '',
          `Title: ${title}`,
          params.dueDate ? `Due: ${formatDate(params.dueDate)}` : ''
        ].filter(Boolean).join('\n')
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
