import axios from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { getMicrosoftAccessToken } from './microsoftAuthService.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const graph = 'https://graph.microsoft.com/v1.0';

function eventTimes(input: any) {
  const zone = input.timezone || 'UTC';
  return {
    start: dayjs.tz(`${input.date} ${input.startTime}`, 'YYYY-MM-DD HH:mm', zone).format('YYYY-MM-DDTHH:mm:ss'),
    end: dayjs.tz(`${input.date} ${input.endTime}`, 'YYYY-MM-DD HH:mm', zone).format('YYYY-MM-DDTHH:mm:ss'),
    timezone: zone
  };
}

export async function listMicrosoftEvents(userId: string, timeMin?: string, timeMax?: string) {
  const token = await getMicrosoftAccessToken(userId);
  const start = timeMin ?? new Date().toISOString();
  const params: Record<string, string> = {
    startDateTime: start,
    endDateTime: timeMax ?? dayjs(start).add(60, 'day').toISOString(),
    '$orderby': 'start/dateTime',
    '$top': '100'
  };
  const { data } = await axios.get(`${graph}/me/calendarView`, {
    headers: { Authorization: `Bearer ${token}` },
    params
  });
  return data.value ?? [];
}

export async function createMicrosoftEvent(userId: string, input: any) {
  const token = await getMicrosoftAccessToken(userId);
  const { start, end, timezone } = eventTimes(input);
  const { data } = await axios.post(`${graph}/me/events`, {
    subject: input.title,
    body: { contentType: 'Text', content: input.description ?? '' },
    attendees: (input.attendees ?? []).map((email: string) => ({
      emailAddress: { address: email },
      type: 'required'
    })),
    start: { dateTime: start, timeZone: timezone },
    end: { dateTime: end, timeZone: timezone }
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return { event: data };
}

export async function deleteMicrosoftEvent(userId: string, eventId: string) {
  const token = await getMicrosoftAccessToken(userId);
  await axios.delete(`${graph}/me/events/${eventId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function updateMicrosoftEvent(userId: string, eventId: string, input: any) {
  const token = await getMicrosoftAccessToken(userId);
  const { start, end, timezone } = eventTimes(input);
  const { data } = await axios.patch(`${graph}/me/events/${eventId}`, {
    subject: input.title,
    body: { contentType: 'Text', content: input.description ?? '' },
    start: { dateTime: start, timeZone: timezone },
    end: { dateTime: end, timeZone: timezone }
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
}
