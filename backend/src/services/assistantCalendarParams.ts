import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezonePlugin from 'dayjs/plugin/timezone.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

dayjs.extend(utc);
dayjs.extend(timezonePlugin);
dayjs.extend(customParseFormat);

const weekdayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function isCalendarInputValid(params: any) {
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

export function normalizeCalendarParams(params: any, message: string, userTimezone: string) {
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

export function clarifyCalendarRequest(params: any) {
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
