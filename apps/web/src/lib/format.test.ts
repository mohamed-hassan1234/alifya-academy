import { describe, expect, it } from 'vitest';
import { formatDateTime, formatMoney, toDateInputValue, zonedDateToIso } from './format';

describe('format helpers', () => {
  it('formats minor units as currency', () => {
    expect(formatMoney(15000, 'USD')).toBe('US$150');
    expect(formatMoney(1999, 'USD')).toBe('US$19.99');
  });
  it('treats form dates as midnight in the course timezone (Africa/Mogadishu = UTC+3)', () => {
    expect(zonedDateToIso('2026-03-10', 'Africa/Mogadishu')).toBe('2026-03-09T21:00:00.000Z');
    expect(zonedDateToIso('2026-03-10', 'UTC')).toBe('2026-03-10T00:00:00.000Z');
    expect(zonedDateToIso('bad')).toBeNull();
  });
  it('formats date-times in the event timezone with the zone name', () => {
    const s = formatDateTime('2026-03-10T07:30:00.000Z', 'en', 'Africa/Mogadishu');
    expect(s).toContain('10:30');
    expect(s).toMatch(/GMT\+3|EAT/);
    expect(() => formatDateTime('2026-03-10T07:30:00.000Z', 'so')).not.toThrow();
  });
  it('round-trips dates through the timezone', () => {
    const iso = zonedDateToIso('2026-12-31', 'Africa/Mogadishu')!;
    expect(toDateInputValue(iso, 'Africa/Mogadishu')).toBe('2026-12-31');
  });
});
