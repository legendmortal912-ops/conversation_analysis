/**
 * @module utils/date
 * Date formatting and manipulation helpers.
 * All functions work with ISO-8601 strings to maintain consistency
 * across service boundaries (JSON serialization).
 */

/**
 * Returns the current timestamp as an ISO-8601 string.
 *
 * @returns Current UTC time in ISO-8601 format
 *
 * @example
 * ```ts
 * const now = nowISO(); // "2024-01-15T10:30:00.000Z"
 * ```
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Formats a Date or ISO string into a human-readable date string.
 *
 * @param input - Date object or ISO-8601 string
 * @param locale - BCP 47 locale string (default: 'en-US')
 * @returns Formatted date string, e.g. "Jan 15, 2024"
 *
 * @example
 * ```ts
 * formatDate('2024-01-15T10:30:00.000Z'); // "Jan 15, 2024"
 * ```
 */
export function formatDate(input: Date | string, locale: string = 'en-US'): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Formats a Date or ISO string into a human-readable date-time string.
 *
 * @param input - Date object or ISO-8601 string
 * @param locale - BCP 47 locale string (default: 'en-US')
 * @returns Formatted date-time string, e.g. "Jan 15, 2024, 10:30 AM"
 *
 * @example
 * ```ts
 * formatDateTime('2024-01-15T10:30:00.000Z'); // "Jan 15, 2024, 10:30 AM"
 * ```
 */
export function formatDateTime(input: Date | string, locale: string = 'en-US'): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Returns a relative time description (e.g. "3 hours ago", "in 2 days").
 *
 * @param input - Date object or ISO-8601 string
 * @param locale - BCP 47 locale string (default: 'en-US')
 * @returns Relative time string
 *
 * @example
 * ```ts
 * // If current time is 2024-01-15T13:30:00Z
 * formatRelative('2024-01-15T10:30:00.000Z'); // "3 hours ago"
 * ```
 */
export function formatRelative(input: Date | string, locale: string = 'en-US'): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const now = Date.now();
  const diffMs = date.getTime() - now;
  const absDiffMs = Math.abs(diffMs);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  // Choose the best unit based on the magnitude of the difference
  if (absDiffMs < 60_000) {
    // Less than 1 minute
    return rtf.format(Math.round(diffMs / 1_000), 'second');
  }
  if (absDiffMs < 3_600_000) {
    // Less than 1 hour
    return rtf.format(Math.round(diffMs / 60_000), 'minute');
  }
  if (absDiffMs < 86_400_000) {
    // Less than 1 day
    return rtf.format(Math.round(diffMs / 3_600_000), 'hour');
  }
  if (absDiffMs < 2_592_000_000) {
    // Less than 30 days
    return rtf.format(Math.round(diffMs / 86_400_000), 'day');
  }
  if (absDiffMs < 31_536_000_000) {
    // Less than 365 days
    return rtf.format(Math.round(diffMs / 2_592_000_000), 'month');
  }
  return rtf.format(Math.round(diffMs / 31_536_000_000), 'year');
}

/**
 * Adds a specified duration to a date and returns the new ISO-8601 string.
 *
 * @param input - Base Date or ISO-8601 string
 * @param durationMs - Duration in milliseconds to add (can be negative)
 * @returns New ISO-8601 timestamp
 *
 * @example
 * ```ts
 * addDuration('2024-01-15T10:00:00.000Z', 3_600_000); // 1 hour later
 * ```
 */
export function addDuration(input: Date | string, durationMs: number): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  return new Date(date.getTime() + durationMs).toISOString();
}

/** Milliseconds in common time periods for convenience. */
export const DURATION = {
  /** 1 second in ms. */
  SECOND: 1_000,
  /** 1 minute in ms. */
  MINUTE: 60_000,
  /** 1 hour in ms. */
  HOUR: 3_600_000,
  /** 1 day in ms. */
  DAY: 86_400_000,
  /** 1 week in ms. */
  WEEK: 604_800_000,
  /** 30 days in ms (approximate month). */
  MONTH: 2_592_000_000,
  /** 365 days in ms (approximate year). */
  YEAR: 31_536_000_000,
} as const;

/**
 * Checks whether a given timestamp (ISO-8601 or Date) is in the past.
 *
 * @param input - Date or ISO-8601 string to check
 * @returns true if the date is before the current time
 */
export function isExpired(input: Date | string): boolean {
  const date = typeof input === 'string' ? new Date(input) : input;
  return date.getTime() < Date.now();
}

/**
 * Returns the start-of-day (midnight UTC) for a given date.
 *
 * @param input - Date or ISO-8601 string
 * @returns ISO-8601 string at 00:00:00.000Z of that day
 */
export function startOfDay(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Returns the end-of-day (23:59:59.999 UTC) for a given date.
 *
 * @param input - Date or ISO-8601 string
 * @returns ISO-8601 string at 23:59:59.999Z of that day
 */
export function endOfDay(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d.toISOString();
}
