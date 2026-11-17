// lib/v1/dates.js
// Calendar days for /api/v1. The contract uses `YYYY-MM-DD` in the user's
// local time, so "today" depends on their time zone. The app sends it as an
// IANA name in the `X-Time-Zone` header (e.g. America/Chicago); without it,
// or with an unknown name, the server uses UTC.
//
// Day strings are compared as strings and shifted with UTC date maths, which
// is safe because they carry no time of day.
import { WEEKDAYS } from './vocab'

export function timeZoneOf(req) {
  const tz = req.headers?.['x-time-zone']
  if (typeof tz !== 'string' || tz.length > 64) return 'UTC'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return tz
  } catch {
    return 'UTC'
  }
}

/** Today's date (YYYY-MM-DD) in `timeZone`. */
export function todayIn(timeZone, now = new Date()) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

const toUtc = day => new Date(`${day}T00:00:00Z`)
const fromUtc = d => d.toISOString().slice(0, 10)

export function addDays(day, n) {
  const d = toUtc(day)
  d.setUTCDate(d.getUTCDate() + n)
  return fromUtc(d)
}

/** 'mon' … 'sun' */
export function weekdayOf(day) {
  return WEEKDAYS[(toUtc(day).getUTCDay() + 6) % 7]
}

/** The Monday of the week `day` is in. */
export function mondayOf(day) {
  return addDays(day, -WEEKDAYS.indexOf(weekdayOf(day)))
}

/** The date of `weekday` in the week starting `monday`. */
export function dateOfWeekday(monday, weekday) {
  return addDays(monday, WEEKDAYS.indexOf(weekday))
}

export const isDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  fromUtc(toUtc(value)) === value

/** First day of the month `day` is in, and the number of days in it. */
export function monthOf(day) {
  const first = `${day.slice(0, 7)}-01`
  const next = toUtc(first)
  next.setUTCMonth(next.getUTCMonth() + 1)
  const days = Math.round((next - toUtc(first)) / 86400000)
  return { first, days }
}
