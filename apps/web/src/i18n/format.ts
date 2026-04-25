/**
 * Intl-based formatting primitives — see SPEC.md §5.8 "Formatting".
 *
 * Why pure `Intl.*` and not a date library: every supported locale lives in
 * the platform's CLDR data already, so there's nothing to ship. Functions
 * are deliberately small and stateless; callers pass `locale` explicitly
 * (typically from `useTranslation().i18n.language`).
 */

export type Units = 'metric' | 'imperial';

const UNIT_MAP = {
  metric: 'celsius',
  imperial: 'fahrenheit',
} as const;

/** "27°C" / "80°F", rounded to integer per the wireframe. */
export function formatTemperature(value: number, units: Units, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: UNIT_MAP[units],
    unitDisplay: 'short',
    maximumFractionDigits: 0,
  }).format(value);
}

function toDate(value: Date | string): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

/** "14:30" / "2:30 PM" — locale decides 12h vs 24h. */
export function formatTime(value: Date | string, locale: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(toDate(value));
}

/** "Sat" / "lør" / "Sa." — short weekday for the 7-day strip. */
export function formatWeekday(value: Date | string, locale: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    timeZone,
  }).format(toDate(value));
}

/**
 * "5 minutes ago" — picks the largest sensible unit (s, min, h, d) so we
 * never get "300 seconds ago". `numeric: 'auto'` lets the formatter say
 * "yesterday" / "now" where appropriate.
 *
 * Sign convention: `from` describes the event, `to` is the reference (usually
 * `new Date()`). A `from` in the past produces a negative delta and reads as
 * "...ago".
 */
export function formatRelativeTime(from: Date | string, to: Date | string, locale: string): string {
  const seconds = (toDate(from).getTime() - toDate(to).getTime()) / 1000;
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (abs < 60) return rtf.format(Math.round(seconds), 'second');
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
  return rtf.format(Math.round(seconds / 86400), 'day');
}

/**
 * "Norway" / "Norge" / "Norwegen" from an ISO 3166-1 alpha-2 code.
 *
 * Returns an empty string when `code` is empty so callers don't have to
 * pre-guard. Returns the code itself if `Intl.DisplayNames` can't
 * recognize it (unknown subdivisions, malformed codes, etc.).
 */
export function formatCountry(code: string, locale: string): string {
  if (!code) return '';
  try {
    return new Intl.DisplayNames(locale, { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** "English" / "Englisch" / "Engelsk" from a BCP-47 language tag. */
export function formatLanguage(code: string, locale: string): string {
  return new Intl.DisplayNames(locale, { type: 'language' }).of(code) ?? code;
}

/** "Berlin, Paris and Madrid" / "Berlin, Paris und Madrid". */
export function formatList(items: readonly string[], locale: string): string {
  return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(items);
}
