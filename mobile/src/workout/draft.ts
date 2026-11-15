// Local state of an in-progress workout (RYR-24).
//
// The screen works on this draft and never waits for the server. Drafts are
// kept per session id for the app run, so closing the workout and opening it
// again picks up where the user left off, even if queued calls haven't synced.
import type { PrescribedExercise, Session, SkipReason } from '../api';

export type ExerciseMark = { status: 'done' } | { status: 'skipped'; reason: SkipReason };

export type WorkoutDraft = {
  sessionId: string;
  sessionName: string;
  /** When the timer started (epoch ms). */
  startedAtMs: number;
  exercises: PrescribedExercise[];
  /** Per exercise: null until done or skipped. */
  marks: (ExerciseMark | null)[];
  /** Per exercise, per set: reps logged, or null. */
  sets: (number | null)[][];
};

const drafts = new Map<string, WorkoutDraft>();

export const getDraft = (sessionId: string) => drafts.get(sessionId);
export const saveDraft = (draft: WorkoutDraft) => void drafts.set(draft.sessionId, draft);
export const clearDraft = (sessionId: string) => void drafts.delete(sessionId);

/** Reps to log for one set when the user taps Done: the number, the low end of a range, or null for "max". */
export function targetReps(reps: string): number | null {
  const n = parseInt(reps, 10);
  return Number.isFinite(n) ? n : null;
}

export function draftFromSession(session: Session): WorkoutDraft {
  const exercises = session.exercises.map((e) => ({ ...e }));
  const marks = exercises.map((e): ExerciseMark | null => {
    const log = session.logs.find((l) => l.exerciseId === e.exerciseId);
    if (!log) return null;
    return log.status === 'done' ? { status: 'done' } : { status: 'skipped', reason: log.reason };
  });
  const sets = exercises.map((e) => {
    const log = session.logs.find((l) => l.exerciseId === e.exerciseId);
    return Array.from({ length: e.sets }, (_, i) => {
      if (log?.status !== 'done') return null;
      return log.sets?.[i]?.reps ?? targetReps(e.reps);
    });
  });
  return {
    sessionId: session.id,
    sessionName: session.name,
    startedAtMs: session.startedAt ? Date.parse(session.startedAt) : Date.now(),
    exercises,
    marks,
    sets,
  };
}
