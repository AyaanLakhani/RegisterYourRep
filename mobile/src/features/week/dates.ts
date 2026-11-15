// Small date helpers for YYYY-MM-DD calendar days (no time zone involved).
import type { DayDate } from '../../api';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

const parse = (date: DayDate) => new Date(`${date}T00:00:00.000Z`);

export function addDays(date: DayDate, days: number): DayDate {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const dayOfMonth = (date: DayDate) => parse(date).getUTCDate();

/** 0 = Monday … 6 = Sunday. */
export const weekdayIndex = (date: DayDate) => (parse(date).getUTCDay() + 6) % 7;

export const dayName = (date: DayDate) => DAY_NAMES[weekdayIndex(date)];

/** "Nov 9 – 15", or "Oct 26 – Nov 1" when the week spans two months. */
export function formatRange(start: DayDate, end: DayDate): string {
  const s = parse(start);
  const e = parse(end);
  const sm = MONTHS[s.getUTCMonth()];
  const em = MONTHS[e.getUTCMonth()];
  return sm === em
    ? `${sm} ${s.getUTCDate()} – ${e.getUTCDate()}`
    : `${sm} ${s.getUTCDate()} – ${em} ${e.getUTCDate()}`;
}

/** The seven days of the week starting at `monday`. */
export const weekDays = (monday: DayDate): DayDate[] => Array.from({ length: 7 }, (_, i) => addDays(monday, i));
