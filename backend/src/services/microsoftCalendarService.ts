import axios from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { getMicrosoftAccessToken, getMicrosoftAccessTokenForConnectedAccount } from './microsoftAuthService.js';

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

async function listMicrosoftEventsWithToken(token: string, timeMin?: string, timeMax?: string, meta: Record<string, string> = {}) {
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
  return (data.value ?? []).map((event: any) => ({
    ...event,
    id: meta.accountId && meta.accountId !== 'primary' ? `${meta.accountId}:${event.id}` : event.id,
    accountId: meta.accountId,
    accountEmail: meta.accountEmail,
    provider: 'microsoft'
  }));
}

export async function listMicrosoftEvents(userId: string, timeMin?: string, timeMax?: string) {
  const token = await getMicrosoftAccessToken(userId);
  return listMicrosoftEventsWithToken(token, timeMin, timeMax, { accountId: 'primary', provider: 'microsoft' });
}

export async function listMicrosoftEventsForConnectedAccount(tenantId: string, userId: string, accountId: string, accountEmail: string, timeMin?: string, timeMax?: string) {
  const token = await getMicrosoftAccessTokenForConnectedAccount(tenantId, userId, accountId);
  return listMicrosoftEventsWithToken(token, timeMin, timeMax, { accountId, accountEmail, provider: 'microsoft' });
}

async function createMicrosoftEventWithToken(token: string, input: any) {
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

export async function createMicrosoftEvent(userId: string, input: any) {
  const token = await getMicrosoftAccessToken(userId);
  return createMicrosoftEventWithToken(token, input);
}

export async function createMicrosoftEventForConnectedAccount(tenantId: string, userId: string, accountId: string, input: any) {
  const token = await getMicrosoftAccessTokenForConnectedAccount(tenantId, userId, accountId);
  return createMicrosoftEventWithToken(token, input);
}

export async function deleteMicrosoftEvent(userId: string, eventId: string) {
  const token = await getMicrosoftAccessToken(userId);
  await deleteMicrosoftEventWithToken(token, eventId);
}

async function deleteMicrosoftEventWithToken(token: string, eventId: string) {
  await axios.delete(`${graph}/me/events/${eventId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function deleteMicrosoftEventForConnectedAccount(tenantId: string, userId: string, accountId: string, eventId: string) {
  const token = await getMicrosoftAccessTokenForConnectedAccount(tenantId, userId, accountId);
  await deleteMicrosoftEventWithToken(token, eventId);
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
