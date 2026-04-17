import { describe, expect, it, vi } from 'vitest';
import { dateToPhtDayStr, getPhtDayBounds, getCurrentPhtDay } from '@/lib/dateUtils';

describe('dateUtils PHT helpers', () => {
  it('converts UTC timestamps to the correct PHT day across midnight boundaries', () => {
    expect(dateToPhtDayStr(new Date('2026-04-16T15:59:59.000Z'))).toBe('2026-04-16');
    expect(dateToPhtDayStr(new Date('2026-04-16T16:00:00.000Z'))).toBe('2026-04-17');
  });

  it('computes UTC bounds for a PHT day', () => {
    const { dayStart, dayEnd } = getPhtDayBounds('2026-04-17');

    expect(dayStart.toISOString()).toBe('2026-04-16T16:00:00.000Z');
    expect(dayEnd.toISOString()).toBe('2026-04-17T15:59:59.999Z');
  });

  it('returns the current PHT day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-16T16:30:00.000Z'));

    expect(getCurrentPhtDay()).toBe('2026-04-17');

    vi.useRealTimers();
  });
});
