import { google } from 'googleapis';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { getAuthorizedGoogleClient } from './googleAuthService.js';
import { HttpError } from '../utils/http.js';

dayjs.extend(utc);
dayjs.extend(timezone);

function eventTimes(input: any) {
  const zone = input.timezone || 'UTC';
  const startDate = dayjs.tz(`${input.date} ${input.startTime}`, 'YYYY-MM-DD HH:mm', zone);
  const endDate = dayjs.tz(`${input.date} ${input.endTime}`, 'YYYY-MM-DD HH:mm', zone);
  if (!startDate.isValid() || !endDate.isValid() || !endDate.isAfter(startDate)) {
    throw new HttpError(400, 'Please provide a valid meeting date, start time, and end time.');
  }
  return {
    start: startDate.format(),
    end: endDate.format(),
    timezone: zone
  };
}

export async function listEvents(userId: string, timeMin?: string, timeMax?: string) {
  const auth = await getAuthorizedGoogleClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });
  const result = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin ?? new Date().toISOString(),
    timeMax,
    singleEvents: true,
    orderBy: 'startTime'
  });
  return result.data.items ?? [];
}

export async function detectConflicts(userId: string, start: string, end: string) {
  const events = await listEvents(userId, start, end);
  return events.filter((event) => event.start?.dateTime && event.end?.dateTime);
}

export async function suggestAlternativeSlots(userId: string, start: string, end: string) {
  const duration = dayjs(end).diff(dayjs(start), 'minute');
  const base = dayjs(start);
  const candidates = [1, 2, 3, 4, 5].map((offset) => {
    const slotStart = base.add(offset, 'hour');
    return { start: slotStart.toISOString(), end: slotStart.add(duration, 'minute').toISOString() };
  });
  const availability = await Promise.all(candidates.map(async (slot) => ({
    ...slot,
    conflicts: await detectConflicts(userId, slot.start, slot.end)
  })));
  return availability.filter((slot) => slot.conflicts.length === 0).slice(0, 3);
}

export async function createEvent(userId: string, input: any, force = false) {
  const { start, end, timezone } = eventTimes(input);
  const conflicts = await detectConflicts(userId, start, end);

  if (conflicts.length && !force) {
    return {
      requiresConfirmation: true,
      conflicts,
      suggestions: await suggestAlternativeSlots(userId, start, end)
    };
  }

  const auth = await getAuthorizedGoogleClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });
  const result = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: input.title,
      description: input.description,
      attendees: (input.attendees ?? []).map((email: string) => ({ email })),
      start: { dateTime: start, timeZone: timezone },
      end: { dateTime: end, timeZone: timezone }
    }
  });
  return { event: result.data };
}

export async function updateEvent(userId: string, eventId: string, input: any, force = false) {
  const { start, end, timezone } = eventTimes(input);
  const conflicts = (await detectConflicts(userId, start, end)).filter((event) => event.id !== eventId);

  if (conflicts.length && !force) {
    return {
      requiresConfirmation: true,
      conflicts,
      suggestions: await suggestAlternativeSlots(userId, start, end)
    };
  }

  const auth = await getAuthorizedGoogleClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });
  const result = await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    requestBody: {
      summary: input.title,
      description: input.description,
      attendees: (input.attendees ?? []).map((email: string) => ({ email })),
      start: { dateTime: start, timeZone: timezone },
      end: { dateTime: end, timeZone: timezone }
    }
  });
  return { event: result.data };
}

export async function checkFreeBusy(userId: string, start: string, end: string, attendees: string[] = []) {
  const auth = await getAuthorizedGoogleClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });
  const result = await calendar.freebusy.query({
    requestBody: {
      timeMin: start,
      timeMax: end,
      items: [{ id: 'primary' }, ...attendees.map((email) => ({ id: email }))]
    }
  });
  return result.data.calendars ?? {};
}

export async function deleteEvent(userId: string, eventId: string) {
  const auth = await getAuthorizedGoogleClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });
  await calendar.events.delete({ calendarId: 'primary', eventId });
}
