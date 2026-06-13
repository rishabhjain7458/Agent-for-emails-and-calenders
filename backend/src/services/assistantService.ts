import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezonePlugin from 'dayjs/plugin/timezone.js';
import { classifyIntent, answerGeneralQuestion, generateEmailSummary, extractAssistantParameters } from './geminiService.js';
import { createEvent, deleteEvent, listEvents } from './calendarService.js';
import { listEmails } from './emailService.js';
import { createTask, listTasks } from '../repositories/taskRepository.js';
import { createGoogleTask } from './googleTasksService.js';
import { getSettings } from '../repositories/settingsRepository.js';

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

export async function handleAssistantMessage(tenantId: string, userId: string, message: string) {
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
      return { intent, result: { deleted: true } };
    case 'email_search':
      return { intent, result: await listEmails(userId, params.query ?? message) };
    case 'email_summary':
      const emails = await listEmails(userId, params.query ?? 'in:inbox newer_than:14d');
      return { intent, result: await generateEmailSummary(tenantId, userId, emails.messages) };
    case 'task_create': {
      const title = params.title || message;
      const googleTask = await createGoogleTask(userId, title, params.dueDate);
      return { intent, result: await createTask(tenantId, userId, title, params.dueDate, googleTask.id) };
    }
    case 'task_list':
      return { intent, result: await listTasks(tenantId) };
    default:
      return { intent, result: await answerGeneralQuestion(tenantId, userId, message) };
  }
}
