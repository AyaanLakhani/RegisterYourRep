// Sample data for the mock data source, matching the design's example user:
// Upper · Lower · PPL program v2 (since Nov 2), week of Nov 9-15 2026, today is
// Thursday Nov 12 (Push).
//
// `createSeed()` returns a fresh copy each time so the mock can mutate it freely.
import type {
  ExerciseLog,
  PrescribedExercise,
  Profile,
  Program,
  ProgramDay,
  ProgressStats,
  Session,
  Weekday,
} from '../schemas';
import { findExercise } from './catalog';

/** The mock's fixed "today", so the sample week always lines up. */
export const MOCK_TODAY = '2026-11-12';
export const MOCK_WEEK_START = '2026-11-09';
export const PROGRAM_NAME = 'Upper · Lower · PPL';

function ex(id: string, sets: number, reps: string, restSeconds: number, formCue?: string): PrescribedExercise {
  const entry = findExercise(id);
  if (!entry) throw new Error(`Unknown catalog id in mock seed: ${id}`);
  return { exerciseId: id, name: entry.name, sets, reps, restSeconds, ...(formCue ? { formCue } : {}) };
}

// --- Program days ----------------------------------------------------------

const upper: ProgramDay = {
  weekday: 'mon',
  name: 'Upper',
  focus: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  estimatedMinutes: 55,
  exercises: [
    ex('bench-press', 4, '8', 120, 'Shoulder blades pinched, feet planted. Touch the lower chest, then press.'),
    ex('dumbbell-row', 4, '10', 90, 'Pull your elbow toward your hip, not your shoulder.'),
    ex('overhead-press', 3, '8', 120),
    ex('lat-pulldown', 3, '10', 90),
    ex('biceps-curl', 3, '12', 60),
    ex('overhead-triceps-extension', 3, '12', 60),
  ],
};

const lower: ProgramDay = {
  weekday: 'tue',
  name: 'Lower',
  focus: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'],
  estimatedMinutes: 50,
  exercises: [
    ex('squat', 4, '6-8', 150, 'Brace before you descend. Knees track over your toes.'),
    ex('romanian-deadlift', 3, '8', 120, 'Push your hips back, keep the bar close to your legs.'),
    ex('leg-press', 3, '10', 90),
    ex('leg-curl', 3, '12', 60),
    ex('calf-raise', 3, '15', 45),
    ex('plank', 3, '45', 45, 'Hold for 45 seconds. Squeeze your glutes and keep your hips level.'),
  ],
};

const push: ProgramDay = {
  weekday: 'thu',
  name: 'Push',
  focus: ['chest', 'shoulders', 'triceps'],
  estimatedMinutes: 55,
  exercises: [
    ex('bench-press', 4, '8', 120, 'Shoulder blades pinched, feet planted. Touch the lower chest, then press.'),
    ex('incline-dumbbell-press', 3, '10', 90),
    ex('cable-fly', 3, '12', 60, 'Slight bend in the elbows. Bring your hands together in a wide hug.'),
    ex('overhead-triceps-extension', 3, '12', 60, 'Keep your elbows pointing up and close to your head. Lower slowly for 2 seconds, then press.'),
    ex('dips', 3, 'max', 90),
    ex('lateral-raise', 3, '15', 45),
  ],
};

const pull: ProgramDay = {
  weekday: 'fri',
  name: 'Pull',
  focus: ['back', 'biceps', 'shoulders'],
  estimatedMinutes: 50,
  exercises: [
    ex('pull-up', 4, 'max', 120),
    ex('cable-row', 3, '10', 90),
    ex('lat-pulldown', 3, '10', 90),
    ex('face-pull', 3, '15', 60),
    ex('biceps-curl', 3, '12', 60),
    ex('hammer-curl', 2, '12', 60),
  ],
};

const legs: ProgramDay = {
  weekday: 'sat',
  name: 'Legs',
  focus: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'],
  estimatedMinutes: 50,
  exercises: [
    ex('deadlift', 3, '5', 180, 'Bar over mid-foot. Push the floor away, keep your back flat.'),
    ex('goblet-squat', 3, '10', 90),
    ex('lunges', 3, '10', 90),
    ex('leg-curl', 3, '12', 60),
    ex('calf-raise', 3, '15', 45),
    ex('hanging-knee-raise', 3, '12', 45),
  ],
};

// v1: the "as asked" program the user started with.
const v1Days: ProgramDay[] = [
  { weekday: 'mon', name: 'Chest', focus: ['chest', 'triceps'], estimatedMinutes: 50, exercises: [ex('bench-press', 4, '8', 120), ex('incline-dumbbell-press', 3, '10', 90), ex('cable-fly', 3, '12', 60), ex('dips', 3, 'max', 90), ex('triceps-pushdown', 3, '12', 60)] },
  { weekday: 'tue', name: 'Back', focus: ['back', 'biceps'], estimatedMinutes: 50, exercises: [ex('pull-up', 4, 'max', 120), ex('dumbbell-row', 4, '10', 90), ex('lat-pulldown', 3, '10', 90), ex('cable-row', 3, '10', 90), ex('biceps-curl', 3, '12', 60)] },
  { weekday: 'thu', name: 'Chest', focus: ['chest', 'shoulders'], estimatedMinutes: 50, exercises: [ex('dumbbell-bench-press', 4, '10', 90), ex('overhead-press', 3, '8', 120), ex('pec-deck', 3, '12', 60), ex('lateral-raise', 3, '15', 45), ex('push-up', 3, 'max', 60)] },
  { weekday: 'fri', name: 'Back', focus: ['back', 'biceps'], estimatedMinutes: 50, exercises: [ex('barbell-row', 4, '8', 120), ex('lat-pulldown', 3, '12', 90), ex('face-pull', 3, '15', 60), ex('hammer-curl', 3, '12', 60), ex('plank', 3, '45', 45)] },
];

export const recommendedDays: ProgramDay[] = [upper, lower, push, pull, legs];
export const asAskedDays: ProgramDay[] = v1Days;

// --- Helpers ---------------------------------------------------------------

export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** Adds days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(date: string): Weekday {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay(); // 0 = Sunday
  return WEEKDAYS[(day + 6) % 7];
}

/** Monday of the week containing `date`. */
export function mondayOf(date: string): string {
  return addDays(date, -WEEKDAYS.indexOf(weekdayOf(date)));
}

export function sessionFromDay(day: ProgramDay, weekStart: string, program: Program, id: string): Session {
  const date = addDays(weekStart, WEEKDAYS.indexOf(day.weekday));
  return {
    id,
    programId: program.id,
    programVersion: program.version,
    date,
    weekday: day.weekday,
    status: 'scheduled',
    name: day.name,
    focus: [...day.focus],
    estimatedMinutes: day.estimatedMinutes,
    exercises: day.exercises.map((e) => ({ ...e })),
    logs: [],
  };
}

function doneLog(exerciseId: string, loggedAt: string): ExerciseLog {
  return { status: 'done', exerciseId, loggedAt };
}

// --- Seed ------------------------------------------------------------------

export interface MockState {
  profile: Profile | null;
  programs: Program[]; // every version, oldest first
  sessions: Session[]; // sessions of the active week
  progress: ProgressStats;
  monthGoal: MonthGoalBase;
}

/**
 * November before this week (Nov 1-8), plus the month's targets. The mock adds
 * this week's finished sessions on top, so finishing a workout moves Home's
 * monthly goal card.
 */
export interface MonthGoalBase {
  month: string;
  sessionsGoal: number;
  sessionsExpectedByToday: number;
  doneBeforeThisWeek: number;
  /** Day types in display order, with the month's goal and days done before this week. */
  types: { type: string; goal: number; doneBeforeThisWeek: number }[];
}

/** Which day types a session counts toward on the monthly goal card. */
export const SESSION_TYPES: Record<string, string[]> = {
  Upper: ['Push', 'Pull'],
  Lower: ['Legs', 'Core'],
  Push: ['Push'],
  Pull: ['Pull'],
  Legs: ['Legs', 'Core'],
};

export function createSeed(): MockState {
  const profile: Profile = {
    id: 'profile-1',
    version: 1,
    createdAt: '2026-10-05T17:40:00.000Z',
    goals: ['build_muscle'],
    trainingDays: ['mon', 'tue', 'thu', 'fri', 'sat'],
    sessionMinutes: 55,
    gymType: 'commercial_gym',
    equipment: ['barbell', 'dumbbell', 'cable', 'machine', 'bench', 'pullup_bar'],
    familiarExerciseIds: ['squat', 'bench-press', 'lat-pulldown', 'dumbbell-row', 'overhead-press', 'pull-up'],
    limitations: '',
    displayName: 'Yara Tan',
    trainingHistory: 'six_months_to_2_years',
    suggestedLevel: 'intermediate',
    level: 'intermediate',
  };

  const v1: Program = {
    id: 'program-v1',
    name: 'Chest/Back split',
    version: 1,
    status: 'archived',
    createdAt: '2026-10-05T17:42:00.000Z',
    note: 'Chest/Back focus',
    profileVersion: 1,
    days: v1Days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) })),
  };

  const v2: Program = {
    id: 'program-v2',
    name: PROGRAM_NAME,
    version: 2,
    status: 'current',
    createdAt: '2026-11-02T08:15:00.000Z',
    note: 'Added lower-body days to balance the week',
    profileVersion: 1,
    days: recommendedDays.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) })),
  };

  const [upperDay, lowerDay, pushDay, pullDay, legsDay] = v2.days;

  // Mon 9: Upper, done 6/6.
  const mon = sessionFromDay(upperDay, MOCK_WEEK_START, v2, 'session-2026-11-09');
  mon.status = 'done';
  mon.startedAt = '2026-11-09T18:05:00.000Z';
  mon.finishedAt = '2026-11-09T18:57:00.000Z';
  mon.logs = mon.exercises.map((e, i) => doneLog(e.exerciseId, `2026-11-09T18:${String(12 + i * 8).padStart(2, '0')}:00.000Z`));

  // Tue 10: Lower, done 5/6 (leg press skipped: no machine free).
  const tue = sessionFromDay(lowerDay, MOCK_WEEK_START, v2, 'session-2026-11-10');
  tue.status = 'done';
  tue.startedAt = '2026-11-10T18:10:00.000Z';
  tue.finishedAt = '2026-11-10T18:58:00.000Z';
  tue.logs = tue.exercises.map((e, i): ExerciseLog => {
    const loggedAt = `2026-11-10T18:${String(16 + i * 8).padStart(2, '0')}:00.000Z`;
    return e.exerciseId === 'leg-press'
      ? { status: 'skipped', exerciseId: e.exerciseId, loggedAt, reason: 'no_equipment' }
      : doneLog(e.exerciseId, loggedAt);
  });

  // Thu 12 (today) Push, Fri 13 Pull, Sat 14 Legs: scheduled.
  const thu = sessionFromDay(pushDay, MOCK_WEEK_START, v2, 'session-2026-11-12');
  const fri = sessionFromDay(pullDay, MOCK_WEEK_START, v2, 'session-2026-11-13');
  const sat = sessionFromDay(legsDay, MOCK_WEEK_START, v2, 'session-2026-11-14');

  const progress: ProgressStats = {
    completionPercent: 87,
    sessionsDone: 26,
    sessionsPlanned: 30,
    streakWeeks: 6,
    muscleBalance: [
      { group: 'upper', actual: 8, target: 8 },
      { group: 'lower', actual: 4, target: 8 },
      { group: 'core', actual: 3, target: 8 },
    ],
    muscleDetail: [
      { muscle: 'chest', group: 'upper', actual: 8, target: 8 },
      { muscle: 'back', group: 'upper', actual: 8, target: 8 },
      { muscle: 'shoulders', group: 'upper', actual: 7, target: 8 },
      { muscle: 'biceps', group: 'upper', actual: 6, target: 8 },
      { muscle: 'triceps', group: 'upper', actual: 7, target: 8 },
      { muscle: 'forearms', group: 'upper', actual: 2, target: 4 },
      { muscle: 'quads', group: 'lower', actual: 4, target: 8 },
      { muscle: 'hamstrings', group: 'lower', actual: 4, target: 8 },
      { muscle: 'glutes', group: 'lower', actual: 4, target: 8 },
      { muscle: 'calves', group: 'lower', actual: 3, target: 6 },
      { muscle: 'abs', group: 'core', actual: 3, target: 8 },
      { muscle: 'obliques', group: 'core', actual: 1, target: 4 },
      { muscle: 'lower_back', group: 'core', actual: 2, target: 4 },
    ],
    mostSkipped: [
      { exerciseId: 'cable-fly', name: 'Cable fly', count: 4, usualReason: 'didnt_know' },
      { exerciseId: 'leg-press', name: 'Leg press', count: 3, usualReason: 'no_equipment' },
    ],
    levelUpReady: false,
  };

  // Matches the design: 6 of 21 sessions once Mon and Tue are counted, 1 behind pace;
  // Push 3/9, Pull 2/9, Legs 3/8, Core 3/8.
  const monthGoal: MonthGoalBase = {
    month: '2026-11-01',
    sessionsGoal: 21,
    sessionsExpectedByToday: 7,
    doneBeforeThisWeek: 4,
    types: [
      { type: 'Push', goal: 9, doneBeforeThisWeek: 2 },
      { type: 'Pull', goal: 9, doneBeforeThisWeek: 1 },
      { type: 'Legs', goal: 8, doneBeforeThisWeek: 2 },
      { type: 'Core', goal: 8, doneBeforeThisWeek: 2 },
    ],
  };

  return { profile, programs: [v1, v2], sessions: [mon, tue, thu, fri, sat], progress, monthGoal };
}
