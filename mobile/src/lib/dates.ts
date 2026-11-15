// Calendar-day helpers for `YYYY-MM-DD` strings (user's local calendar days).
// Arithmetic runs in UTC so it never shifts across daylight-saving changes.
import type { DayDate } from '../api';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const toUtc = (date: DayDate) => new Date(`${date}T00:00:00.000Z`);

export function addDays(date: DayDate, days: number): DayDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Today's calendar day on this device, in its own time zone. */
export function localToday(now = new Date()): DayDate {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export const dayOfMonth = (date: DayDate) => toUtc(date).getUTCDate();

/** "Mon", "Tue", ... */
export const shortWeekday = (date: DayDate) => DAYS[toUtc(date).getUTCDay()].slice(0, 3);

/** "Thursday, Nov 12" */
export function longDate(date: DayDate): string {
  const d = toUtc(date);
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}`;
}

/** "Fri, Nov 13" */
export function shortDate(date: DayDate): string {
  const d = toUtc(date);
  return `${DAYS[d.getUTCDay()].slice(0, 3)}, ${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}`;
}

/** "November 2026", or "Nov – Dec 2026" / "Dec 2026 – Jan 2027" when a week spans two months. */
export function monthLabel(start: DayDate, end: DayDate): string {
  const a = toUtc(start);
  const b = toUtc(end);
  const [am, bm] = [a.getUTCMonth(), b.getUTCMonth()];
  const [ay, by] = [a.getUTCFullYear(), b.getUTCFullYear()];
  if (am === bm && ay === by) return `${MONTHS[am]} ${ay}`;
  if (ay === by) return `${MONTHS[am].slice(0, 3)} – ${MONTHS[bm].slice(0, 3)} ${ay}`;
  return `${MONTHS[am].slice(0, 3)} ${ay} – ${MONTHS[bm].slice(0, 3)} ${by}`;
}

/** "Good morning" / "Good afternoon" / "Good evening" by the device's local hour. */
export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  return 'Good evening';
}
