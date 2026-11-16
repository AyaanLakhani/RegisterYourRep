// Turns a Week into what the Week tab draws. The day rows, the "Week so far"
// numbers and the activity chart all come from here, so they always agree.
import type { DayDate, Session, Week } from '../../api';
import { weekDays } from './dates';

/** How a day is drawn. `missed` = a past, unfinished session in the active week. */
export type DayKind = 'rest' | 'done' | 'skipped' | 'today' | 'upcoming' | 'missed';

export type DayRow = {
  date: DayDate;
  session: Session | null;
  kind: DayKind;
  isToday: boolean;
  /** Minutes trained (done sessions only). */
  doneMinutes: number;
  /** Planned minutes for sessions still to do. */
  plannedMinutes: number;
};

export type WeekView = {
  days: DayRow[];
  sessionsDone: number;
  exercisesDone: number;
  /** Exercises planned in the finished sessions. */
  exercisesPlanned: number;
  sessionsToGo: number;
  minutesDone: number;
};

export function sessionMinutes(s: Session): number {
  if (s.startedAt && s.finishedAt) {
    return Math.max(0, Math.round((Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 60000));
  }
  return s.estimatedMinutes;
}

export function exerciseCounts(s: Session) {
  const done = s.logs.filter((l) => l.status === 'done').length;
  const skipped = s.logs.filter((l) => l.status === 'skipped').length;
  return { done, skipped, total: s.exercises.length };
}

export function buildWeekView(week: Week, today: DayDate | undefined): WeekView {
  const days = weekDays(week.startDate).map((date): DayRow => {
    const session = week.sessions.find((s) => s.date === date) ?? null;
    const isToday = date === today;
    let kind: DayKind;
    if (!session) kind = 'rest';
    else if (session.status === 'done') kind = 'done';
    else if (session.status === 'skipped') kind = 'skipped';
    else if (isToday) kind = 'today';
    else if (today && date < today) kind = 'missed';
    else kind = 'upcoming';
    return {
      date,
      session,
      kind,
      isToday,
      doneMinutes: kind === 'done' && session ? sessionMinutes(session) : 0,
      plannedMinutes:
        session && (kind === 'today' || kind === 'upcoming' || kind === 'missed') ? session.estimatedMinutes : 0,
    };
  });

  const finished = days.filter((d) => d.kind === 'done').map((d) => d.session!);
  return {
    days,
    sessionsDone: finished.length,
    exercisesDone: finished.reduce((n, s) => n + exerciseCounts(s).done, 0),
    exercisesPlanned: finished.reduce((n, s) => n + s.exercises.length, 0),
    sessionsToGo: days.filter((d) => d.kind === 'today' || d.kind === 'upcoming' || d.kind === 'missed').length,
    minutesDone: days.reduce((n, d) => n + d.doneMinutes, 0),
  };
}

/** Days a session can move to: today or later in the active week, with no session yet. */
export function moveTargets(view: WeekView, session: Session, today: DayDate | undefined): DayDate[] {
  return view.days
    .filter((d) => d.session === null && d.date !== session.date && (!today || d.date >= today))
    .map((d) => d.date);
}
