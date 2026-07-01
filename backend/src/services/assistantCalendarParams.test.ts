import { describe, expect, it, vi } from 'vitest';
import { isCalendarInputValid, normalizeCalendarParams } from './assistantCalendarParams.js';

describe('assistant calendar parameter helpers', () => {
  it('infers tomorrow and a single-time range from natural language', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-02T06:30:00.000Z'));

    const params = normalizeCalendarParams(
      { missing: ['date', 'startTime', 'endTime', 'timezone'] },
      'Create a meeting with Rishabh tomorrow at 3 pm',
      'Asia/Kolkata'
    );

    expect(params.title).toBe('Meeting with Rishabh');
    expect(params.date).toBe('2026-07-03');
    expect(params.startTime).toBe('15:00');
    expect(params.endTime).toBe('15:30');
    expect(params.timezone).toBe('Asia/Kolkata');
    expect(isCalendarInputValid(params)).toBe(true);

    vi.useRealTimers();
  });

  it('rejects invalid end times', () => {
    expect(isCalendarInputValid({
      title: 'Review',
      date: '2026-07-03',
      startTime: '15:00',
      endTime: '14:30',
      timezone: 'Asia/Kolkata'
    })).toBe(false);
  });
});
