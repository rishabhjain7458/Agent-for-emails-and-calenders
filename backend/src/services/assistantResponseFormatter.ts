import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezonePlugin from 'dayjs/plugin/timezone.js';
import type { EmailMessage } from '../types.js';

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

export function preferredTimezone(value?: string | null) {
  return !value || value === 'UTC' ? 'Asia/Kolkata' : value;
}

function formatMeetingTime(params: any) {
  const zone = params.timezone || 'Asia/Kolkata';
  const start = dayjs.tz(`${params.date} ${params.startTime}`, 'YYYY-MM-DD HH:mm', zone);
  const end = dayjs.tz(`${params.date} ${params.endTime}`, 'YYYY-MM-DD HH:mm', zone);
  return `${start.format('ddd, D MMM YYYY')} from ${start.format('h:mm A')} to ${end.format('h:mm A')} (${zone})`;
}

export function formatCreatedMeeting(params: any, result: any) {
  const link = result?.event?.htmlLink;
  return [
    'Meeting created.',
    '',
    `Title: ${params.title}`,
    `When: ${formatMeetingTime(params)}`,
    Array.isArray(params.attendees) && params.attendees.length ? `Attendees: ${params.attendees.join(', ')}` : '',
    params.description ? `Notes: ${params.description}` : '',
    link ? `Calendar link: ${link}` : ''
  ].filter(Boolean).join('\n');
}

export function formatConflict(params: any, result: any) {
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

export function formatDate(value?: string | null) {
  if (!value) return 'Date unavailable';
  const date = dayjs(value);
  return date.isValid() ? date.format('ddd, D MMM YYYY, h:mm A') : value;
}

function eventDateValue(event: any, edge: 'start' | 'end' = 'start') {
  const value = event?.[edge]?.dateTime ?? event?.[edge]?.date ?? event?.[`${edge}Time`] ?? event?.[edge];
  return typeof value === 'string' ? value : null;
}

function formatCalendarEventTime(event: any) {
  const startValue = eventDateValue(event, 'start');
  const endValue = eventDateValue(event, 'end');
  if (!startValue) return 'Date unavailable';

  const isAllDay = Boolean(event?.start?.date && !event?.start?.dateTime);
  const start = dayjs(startValue);
  const end = endValue ? dayjs(endValue) : null;
  if (!start.isValid()) return startValue;
  if (isAllDay) return `${start.format('ddd, D MMM YYYY')} · All day`;
  if (end?.isValid()) return `${start.format('ddd, D MMM YYYY, h:mm A')} - ${end.format('h:mm A')}`;
  return start.format('ddd, D MMM YYYY, h:mm A');
}

export function compactText(value?: string | null, limit = 180) {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1).trim()}...` : normalized;
}

export function formatCalendarAgenda(events: any[], params: any = {}) {
  const sorted = [...events]
    .map((event) => ({ event, starts: dayjs(eventDateValue(event, 'start') ?? '') }))
    .sort((a, b) => {
      const aTime = a.starts.isValid() ? a.starts.valueOf() : Number.MAX_SAFE_INTEGER;
      const bTime = b.starts.isValid() ? b.starts.valueOf() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    })
    .map(({ event }) => event);

  const rangeStart = params.timeMin ? dayjs(params.timeMin) : null;
  const rangeEnd = params.timeMax ? dayjs(params.timeMax) : null;
  const range = rangeStart?.isValid() && rangeEnd?.isValid()
    ? `${rangeStart.format('D MMM YYYY')} - ${rangeEnd.format('D MMM YYYY')}`
    : 'Upcoming';

  if (!sorted.length) {
    return [
      'Calendar agenda',
      '',
      `Range: ${range}`,
      'Status: No events found.',
      '',
      'Next step: Try a wider range, like "show this month" or "next 30 days".'
    ].join('\n');
  }

  const visible = sorted.slice(0, 12);
  const rows = visible.flatMap((event, index) => {
    const title = event.summary ?? event.subject ?? event.title ?? '(No title)';
    return [
      `Event ${index + 1}:`,
      `Title: ${title}`,
      `When: ${formatCalendarEventTime(event)}`,
      event.accountEmail ? `Calendar: ${event.accountEmail}` : '',
      event.location ? `Location: ${event.location}` : '',
      event.description ? `Notes: ${compactText(event.description, 140)}` : '',
      ''
    ].filter((line, lineIndex, lines) => line || lines[lineIndex - 1]);
  });

  return [
    'Calendar agenda',
    '',
    `Range: ${range}`,
    `Found: ${sorted.length} event${sorted.length === 1 ? '' : 's'}`,
    '',
    'Events:',
    ...rows,
    sorted.length > visible.length ? `More: ${sorted.length - visible.length} additional events not shown.` : ''
  ].filter(Boolean).join('\n').trim();
}

export function formatEmailSearch(emails: EmailMessage[], query: string) {
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

export function formatEmailSummaryEmpty(query: string) {
  return [
    'Email summary',
    '',
    'Status: No matching emails found.',
    `Search used: ${query}`,
    '',
    'What I checked:',
    '- Inbox scope first, unless you asked for sent mail.',
    '- Unread and primary/priority filters when requested.',
    '',
    'Next step: Try "summarize unread from the last 30 days" or remove the priority filter.'
  ].join('\n');
}

export function formatTaskList(tasks: any[]) {
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

export function formatTaskCreated(title: string, dueDate?: string | null) {
  return [
    'Task created',
    '',
    `Title: ${title}`,
    dueDate ? `Due: ${formatDate(dueDate)}` : 'Due: No due date',
    'Status: Pending'
  ].join('\n');
}
