import { DEFAULT_TIMEZONE } from '@alifya/shared';

const localeFor = (lang: string) => (lang === 'so' ? 'so-SO' : 'en-GB');

/** Formats minor units (cents) as currency. */
export function formatMoney(minor: number, currency: string, lang = 'en'): string {
  try {
    return new Intl.NumberFormat(localeFor(lang), {
      style: 'currency',
      currency,
      minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

/** Dates are always rendered in the EVENT's timezone (default Africa/Mogadishu), never the browser's guess. */
export function formatDate(iso: string | null | undefined, lang = 'en', timeZone = DEFAULT_TIMEZONE): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat(localeFor(lang), { dateStyle: 'medium', timeZone }).format(new Date(iso));
}

export function formatDateTime(
  iso: string | null | undefined,
  lang = 'en',
  timeZone = DEFAULT_TIMEZONE,
): string {
  if (!iso) return '';
  // dateStyle/timeStyle cannot be combined with timeZoneName, so spell out the components.
  return new Intl.DateTimeFormat(localeFor(lang), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
    timeZoneName: 'short',
  }).format(new Date(iso));
}

/**
 * Interprets a yyyy-mm-dd date as local midnight in `timeZone` and returns the absolute UTC ISO instant.
 * (Two-pass offset resolution handles DST zones; Africa/Mogadishu is a fixed UTC+3.)
 */
export function zonedDateToIso(date: string, timeZone = DEFAULT_TIMEZONE): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d);
  const offsetAt = (ts: number) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
        .formatToParts(new Date(ts))
        .map((p) => [p.type, p.value]),
    );
    const asUtc = Date.UTC(
      +parts.year!,
      +parts.month! - 1,
      +parts.day!,
      +parts.hour!,
      +parts.minute!,
      +parts.second!,
    );
    return asUtc - ts;
  };
  let ts = guess - offsetAt(guess);
  ts = guess - offsetAt(ts);
  return new Date(ts).toISOString();
}

/** Converts an ISO timestamp to a yyyy-mm-dd value for <input type="date"> in the given timezone. */
export function toDateInputValue(iso: string | null | undefined, timeZone = DEFAULT_TIMEZONE): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}
