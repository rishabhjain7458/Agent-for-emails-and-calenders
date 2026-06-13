import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezonePlugin from 'dayjs/plugin/timezone.js';
import { classifyIntent, answerGeneralQuestion, generateEmailSummary, extractAssistantParameters } from './geminiService.js';
import { createEvent, deleteEvent, listEvents } from './calendarService.js';
import { listEmails } from './emailService.js';
import { listMicrosoftEmails } from './microsoftEmailService.js';
import { createTask, listTasks } from '../repositories/taskRepository.js';
import { createGoogleTask } from './googleTasksService.js';
import { createMicrosoftTask } from './microsoftTasksService.js';
import { getSettings } from '../repositories/settingsRepository.js';
import type { AuthUser, EmailMessage } from '../types.js';

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

function isCalendarInputValid(params: any) {
  if (!params?.title || !params?.date || !params?.startTime || !params?.endTime) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) return false;
  if (!/^\d{2}:\d{2}$/.test(params.startTime) || !/^\d{2}:\d{2}$/.test(params.endTime)) return false;
  const zone = params.timezone || 'UTC';
  const start = dayjs.tz(`${params.date} ${params.startTime}`, 'YYYY-MM-DD HH:mm', zone);
  const end = dayjs.tz(`${params.date} ${params.endTime}`, 'YYYY-MM-DD HH:mm', zone);
  return start.isValid() && end.isValid() && end.isAfter(start);
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

async function searchEmails(user: AuthUser, query: string) {
  return user.provider === 'microsoft'
    ? listMicrosoftEmails(user.id, query)
    : listEmails(user.id, query);
}

export async function handleAssistantMessage(user: AuthUser, message: string) {
  const tenantId = user.tenantId;
  const userId = user.id;
  const intent = await classifyIntent(tenantId, userId, message);
  const settings = await getSettings(tenantId, userId);
  const userTimezone = preferredTimezone(settings.timezone);
  const extracted = await extractAssistantParameters(tenantId, userId, intent, message, userTimezone);
  const params = { ...(intent.parameters as any), ...extracted };

  switch (intent.intent) {
    case 'calendar_create': {
      const calendarParams = {
        ...params,
        timezone: params.timezone || userTimezone,
        attendees: Array.isArray(params.attendees) ? params.attendees.filter((item: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)) : []
      };
      if (!isCalendarInputValid(calendarParams)) {
        return { intent, result: clarifyCalendarRequest(calendarParams) };
      }
      calendarParams.description = calendarParams.description || message;
      const created = await createEvent(userId, calendarParams, false);
      return {
        intent,
        result: created.requiresConfirmation ? formatConflict(calendarParams, created) : formatCreatedMeeting(calendarParams, created)
      };
    }
    case 'calendar_check':
      return { intent, result: await listEvents(userId, params.timeMin, params.timeMax) };
    case 'calendar_delete':
      await deleteEvent(userId, params.eventId);
      return { intent, result: 'Calendar event deleted.' };
    case 'email_search': {
      const query = params.query ?? message;
      const emails = await searchEmails(user, query);
      return { intent, result: formatEmailSearch(emails.messages, query) };
    }
    case 'email_summary': {
      const query = params.query ?? 'in:inbox newer_than:14d';
      const emails = await searchEmails(user, query);
      return { intent, result: await generateEmailSummary(tenantId, userId, emails.messages) };
    }
    case 'task_create': {
      const title = params.title || message;
      const providerTask = user.provider === 'microsoft'
        ? await createMicrosoftTask(userId, title, params.dueDate)
        : await createGoogleTask(userId, title, params.dueDate);
      await createTask(tenantId, userId, title, params.dueDate, providerTask.id);
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
      return { intent, result: formatTaskList(await listTasks(tenantId)) };
    default:
      return { intent, result: await answerGeneralQuestion(tenantId, userId, message) };
  }
}
