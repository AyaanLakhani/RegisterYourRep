// In-memory DataSource used while the v1 API is being built (RYR-30).
//
// State lives in this module (per app run). Mutations change it and resolve
// after a short artificial delay so loading states are visible. Everything
// returned is a deep copy, so screens can't mutate the store by accident.
import { ApiError } from '../client';
import type { DataSource } from '../dataSource';
import type {
  CoachChangeProposal,
  CoachMessage,
  ExerciseCatalogEntry,
  GenerationJob,
  GenerationStep,
  MostSkippedEntry,
  Program,
  ProgramDay,
  ProgramProposal,
  RepeatSkipNudge,
  Session,
  Week,
  WeekSummary,
} from '../schemas';
import { catalog, familiarityIds, findExercise } from './catalog';
import {
  addDays,
  asAskedDays,
  createSeed,
  MOCK_TODAY,
  MOCK_WEEK_START,
  mondayOf,
  PROGRAM_NAME,
  recommendedDays,
  sessionFromDay,
  weekdayOf,
  WEEKDAYS,
  type MockState,
} from './seed';

export { MOCK_TODAY, MOCK_WEEK_START } from './seed';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const notFound = (what: string) => new ApiError(404, `${what} not found`);
const badRequest = (message: string) => new ApiError(400, message);

const STEP_LABELS: Record<GenerationStep['id'], string> = {
  reading_answers: 'Reading your answers',
  picking_exercises: 'Picking exercises',
  balancing_muscles: 'Balancing muscles',
  setting_sets_reps: 'Setting sets and reps',
};
const STEP_IDS = Object.keys(STEP_LABELS) as GenerationStep['id'][];
const SKIP_REASON_TEXT = {
  no_equipment: 'no equipment free',
  didnt_know: "you didn't know it",
  pain: 'it hurt',
  time: 'you ran out of time',
} as const;

export interface MockOptions {
  /** Artificial latency per call. Default 300 ms. */
  delayMs?: number;
  /** How long each generation step takes. Default 1200 ms. */
  generationStepMs?: number;
  /** Clock used for timestamps and generation progress. */
  now?: () => Date;
}

export function createMockDataSource(options: MockOptions = {}): DataSource & { reset(): void } {
  const delayMs = options.delayMs ?? 300;
  const stepMs = options.generationStepMs ?? 1200;
  const now = options.now ?? (() => new Date());

  let state: MockState = createSeed();
  let jobs: { job: GenerationJob; startedAt: number }[] = [];
  let proposals: ProgramProposal[] = [];
  let changes: CoachChangeProposal[] = [];
  let idCounter = 0;

  const nextId = (prefix: string) => `${prefix}-${++idCounter}`;
  const nowIso = () => now().toISOString();
  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, delayMs));
  async function respond<T>(fn: () => T): Promise<T> {
    await wait();
    return clone(fn());
  }

  // --- Lookups -------------------------------------------------------------

  const currentProgram = (): Program => {
    const p = state.programs.find((x) => x.status === 'current');
    if (!p) throw notFound('Program');
    return p;
  };

  const findSession = (id: string): Session => {
    const s = state.sessions.find((x) => x.id === id);
    if (!s) throw notFound('Session');
    return s;
  };

  /** Archives the current program and adds `days` as the next version. */
  function addProgramVersion(days: ProgramDay[], note: string, name?: string): Program {
    const prev = currentProgram();
    prev.status = 'archived';
    const version = Math.max(...state.programs.map((p) => p.version)) + 1;
    const next: Program = {
      id: `program-v${version}`,
      name: name ?? prev.name,
      version,
      status: 'current',
      createdAt: nowIso(),
      note,
      profileVersion: state.profile?.version ?? 1,
      days: clone(days),
    };
    state.programs.push(next);
    return next;
  }

  /** Re-fills untouched upcoming sessions of the active week from the current program. */
  function refreshUpcomingSessions() {
    const program = currentProgram();
    for (const s of state.sessions) {
      if (s.status !== 'scheduled' || s.logs.length > 0 || s.date < MOCK_TODAY) continue;
      const day = program.days.find((d) => d.weekday === s.weekday);
      if (!day) continue;
      s.programId = program.id;
      s.programVersion = program.version;
      s.name = day.name;
      s.focus = [...day.focus];
      s.estimatedMinutes = day.estimatedMinutes;
      s.exercises = clone(day.exercises);
    }
  }

  function summarize(sessions: Session[]): WeekSummary {
    const finished = sessions.filter((s) => s.status === 'done');
    const logs = finished.flatMap((s) => s.logs);
    const muscles = new Set(finished.flatMap((s) => s.focus));
    const minutes = finished.reduce((sum, s) => {
      if (s.startedAt && s.finishedAt) {
        return sum + Math.round((Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 60000);
      }
      return sum + s.estimatedMinutes;
    }, 0);
    return {
      sessionsDone: finished.length,
      sessionsPlanned: sessions.filter((s) => s.status !== 'skipped').length,
      exercisesDone: logs.filter((l) => l.status === 'done').length,
      exercisesSkipped: logs.filter((l) => l.status === 'skipped').length,
      musclesHit: [...muscles],
      minutes,
    };
  }

  function activeWeek(): Week {
    const program = currentProgram();
    const sessions = [...state.sessions].sort((a, b) => a.date.localeCompare(b.date));
    return {
      id: `week-${MOCK_WEEK_START}`,
      startDate: MOCK_WEEK_START,
      endDate: addDays(MOCK_WEEK_START, 6),
      isActive: true,
      programId: program.id,
      programVersion: program.version,
      sessions,
      summary: summarize(sessions),
    };
  }

  /** Past weeks are generated as fully done; future weeks as scheduled. */
  function otherWeek(startDate: string): Week {
    const program =
      [...state.programs].reverse().find((p) => p.createdAt.slice(0, 10) <= addDays(startDate, 6)) ?? state.programs[0];
    const past = startDate < MOCK_WEEK_START;
    const sessions = program.days.map((day) => {
      const s = sessionFromDay(day, startDate, program, `session-${addDays(startDate, WEEKDAYS.indexOf(day.weekday))}`);
      if (past) {
        s.status = 'done';
        s.startedAt = `${s.date}T18:00:00.000Z`;
        s.finishedAt = `${s.date}T18:${String(Math.min(day.estimatedMinutes, 59)).padStart(2, '0')}:00.000Z`;
        s.logs = s.exercises.map((e) => ({ status: 'done' as const, exerciseId: e.exerciseId, loggedAt: s.finishedAt! }));
      }
      return s;
    });
    return {
      id: `week-${startDate}`,
      startDate,
      endDate: addDays(startDate, 6),
      isActive: false,
      programId: program.id,
      programVersion: program.version,
      sessions,
      summary: summarize(sessions),
    };
  }

  function recordSkip(exerciseId: string, reason: MostSkippedEntry['usualReason']): MostSkippedEntry {
    let entry = state.progress.mostSkipped.find((m) => m.exerciseId === exerciseId);
    if (!entry) {
      entry = { exerciseId, name: findExercise(exerciseId)?.name ?? exerciseId, count: 0, usualReason: reason };
      state.progress.mostSkipped.push(entry);
    }
    entry.count += 1;
    state.progress.mostSkipped.sort((a, b) => b.count - a.count);
    return entry;
  }

  function changeFor(id: string): CoachChangeProposal {
    const c = changes.find((x) => x.id === id);
    if (!c) throw notFound('Change');
    return c;
  }

  // --- DataSource ----------------------------------------------------------

  return {
    reset() {
      state = createSeed();
      jobs = [];
      proposals = [];
      changes = [];
      idCounter = 0;
    },

    getProfile: () => respond(() => state.profile),

    saveProfile: (input) =>
      respond(() => {
        state.profile = {
          ...input,
          id: state.profile?.id ?? 'profile-1',
          version: (state.profile?.version ?? 0) + 1,
          createdAt: nowIso(),
          assessedLevel: input.familiarExerciseIds.length >= 6 ? 'intermediate' : 'beginner',
        };
        return state.profile;
      }),

    getFamiliarityOptions: () =>
      respond(() => familiarityIds.map((id) => findExercise(id)).filter((e): e is ExerciseCatalogEntry => !!e)),

    startGeneration: () =>
      respond(() => {
        const job: GenerationJob = {
          id: nextId('job'),
          status: 'pending',
          createdAt: nowIso(),
          steps: STEP_IDS.map((id) => ({ id, label: STEP_LABELS[id], status: 'pending' })),
        };
        jobs.push({ job, startedAt: now().getTime() });
        return job;
      }),

    getGenerationJob: (jobId) =>
      respond(() => {
        const entry = jobs.find((j) => j.job.id === jobId);
        if (!entry) throw notFound('Generation job');
        const { job } = entry;
        const elapsedSteps = Math.floor((now().getTime() - entry.startedAt) / stepMs);
        job.steps = job.steps.map((step, i) => ({
          ...step,
          status: i < elapsedSteps ? 'done' : i === elapsedSteps ? 'running' : 'pending',
        }));
        if (elapsedSteps >= job.steps.length) {
          job.status = 'done';
          if (!job.proposalId) {
            const proposal: ProgramProposal = {
              id: nextId('proposal'),
              jobId: job.id,
              createdAt: nowIso(),
              recommended: {
                kind: 'recommended',
                name: PROGRAM_NAME,
                summary: '5 days · ~50 min · full body every week',
                days: clone(recommendedDays),
              },
              asAsked: {
                kind: 'as_asked',
                name: 'Chest/Back split',
                summary: '4 days · ~50 min · chest and back only',
                days: clone(asAskedDays),
              },
              coachNote:
                'You asked for chest and back, and both are in here. I added two lower-body days because skipping legs ' +
                'for months tends to stall upper-body progress too. You can still pick the version you asked for.',
            };
            proposals.push(proposal);
            job.proposalId = proposal.id;
          }
        } else {
          job.status = 'running';
        }
        return job;
      }),

    getProposal: (proposalId) =>
      respond(() => {
        const p = proposals.find((x) => x.id === proposalId);
        if (!p) throw notFound('Proposal');
        return p;
      }),

    acceptProposal: (proposalId, { choice }) =>
      respond(() => {
        const p = proposals.find((x) => x.id === proposalId);
        if (!p) throw notFound('Proposal');
        const option = choice === 'recommended' ? p.recommended : p.asAsked;
        const program = addProgramVersion(option.days, `Accepted the ${choice === 'recommended' ? 'recommended' : 'as-asked'} plan`, option.name);
        refreshUpcomingSessions();
        return program;
      }),

    getProgram: () =>
      respond(() => ({
        current: currentProgram(),
        versions: [...state.programs]
          .reverse()
          .map(({ id, name, version, status, createdAt, note }) => ({ id, name, version, status, createdAt, note })),
      })),

    getProgramVersion: (version) =>
      respond(() => {
        const p = state.programs.find((x) => x.version === version);
        if (!p) throw notFound('Program version');
        return p;
      }),

    // Day moves apply from next week; the active week keeps its dates.
    saveDayMoves: ({ moves, note }) =>
      respond(() => {
        const days = clone(currentProgram().days);
        for (const move of moves) {
          const day = days.find((d) => d.weekday === move.from);
          if (!day) throw notFound(`Training day on ${move.from}`);
          if (days.some((d) => d !== day && d.weekday === move.to)) {
            throw badRequest(`There is already a session on ${move.to}`);
          }
          day.weekday = move.to;
        }
        days.sort((a, b) => WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday));
        const summary = moves.map((m) => `${m.from} → ${m.to}`).join(', ');
        return addProgramVersion(days, note ?? `Moved ${summary}`);
      }),

    getToday: () =>
      respond(() => ({
        date: MOCK_TODAY,
        session: state.sessions.find((s) => s.date === MOCK_TODAY) ?? null,
        week: activeWeek(),
      })),

    getCurrentWeek: () => respond(activeWeek),

    getWeek: (startDate) =>
      respond(() => {
        const monday = mondayOf(startDate);
        return monday === MOCK_WEEK_START ? activeWeek() : otherWeek(monday);
      }),

    getSession: (sessionId) => respond(() => findSession(sessionId)),

    moveSession: (sessionId, toDate) =>
      respond(() => {
        const s = findSession(sessionId);
        if (s.status === 'done') throw badRequest('Finished sessions cannot be moved');
        if (mondayOf(toDate) !== MOCK_WEEK_START) {
          throw badRequest('Sessions can only move within this week');
        }
        if (state.sessions.some((x) => x !== s && x.date === toDate)) {
          throw badRequest('There is already a session on that day');
        }
        if (s.date !== toDate) {
          s.movedFrom = s.movedFrom ?? s.date;
          s.date = toDate;
          s.weekday = weekdayOf(toDate);
          s.status = s.movedFrom === toDate ? 'scheduled' : 'moved';
          if (s.status === 'scheduled') delete s.movedFrom;
        }
        return activeWeek();
      }),

    logExercise: (sessionId, body) =>
      respond(() => {
        const s = findSession(sessionId);
        const planned = s.exercises.find((e) => e.exerciseId === body.exerciseId);
        if (!planned) throw notFound('Exercise in this session');
        s.startedAt = s.startedAt ?? nowIso();
        s.logs = s.logs.filter((l) => l.exerciseId !== body.exerciseId);

        if (body.action === 'done') {
          s.logs.push({ status: 'done', exerciseId: body.exerciseId, loggedAt: nowIso(), ...(body.sets ? { sets: body.sets } : {}) });
        } else if (body.action === 'skip') {
          s.logs.push({ status: 'skipped', exerciseId: body.exerciseId, loggedAt: nowIso(), reason: body.reason });
        } else {
          const replacement = findExercise(body.replacementId);
          if (!replacement) throw notFound('Replacement exercise');
          Object.assign(planned, {
            exerciseId: replacement.id,
            name: replacement.name,
            swappedFromId: planned.swappedFromId ?? body.exerciseId,
          });
          delete planned.formCue;
        }
        return s;
      }),

    finishSession: (sessionId, body) =>
      respond(() => {
        const s = findSession(sessionId);
        if (s.status === 'done') throw badRequest('Session already finished');
        const finished = now();
        const durationMinutes = body?.durationMinutes ?? s.estimatedMinutes;
        s.startedAt = s.startedAt ?? new Date(finished.getTime() - durationMinutes * 60000).toISOString();
        s.finishedAt = finished.toISOString();
        s.status = 'done';
        delete s.movedFrom;

        let nudge: RepeatSkipNudge | null = null;
        for (const log of s.logs) {
          if (log.status !== 'skipped') continue;
          const entry = recordSkip(log.exerciseId, log.reason);
          if (!nudge && entry.count >= 2) {
            nudge = {
              exerciseId: entry.exerciseId,
              name: entry.name,
              reason: log.reason,
              count: entry.count,
              message: `You've skipped ${entry.name} ${entry.count} times, mostly because ${SKIP_REASON_TEXT[entry.usualReason]}. Want me to swap it for something else?`,
            };
          }
        }

        const p = state.progress;
        p.sessionsDone += 1;
        p.sessionsPlanned += 1;
        p.completionPercent = Math.round((p.sessionsDone / p.sessionsPlanned) * 100);

        const week = activeWeek();
        return {
          session: s,
          exercisesDone: s.logs.filter((l) => l.status === 'done').length,
          exercisesTotal: s.exercises.length,
          durationMinutes,
          streakWeeks: p.streakWeeks,
          sessionsThisWeek: { done: week.summary.sessionsDone, planned: week.summary.sessionsPlanned },
          repeatSkipNudge: nudge,
        };
      }),

    getProgress: () => respond(() => state.progress),

    getAlternatives: (exerciseId) =>
      respond(() => {
        const entry = findExercise(exerciseId);
        if (!entry) throw notFound('Exercise');
        return entry.alternatives.map((id) => catalog.find((e) => e.id === id)).filter((e): e is ExerciseCatalogEntry => !!e);
      }),

    sendCoachMessage: ({ text }) =>
      respond(() => {
        const message: CoachMessage = { id: nextId('msg'), role: 'user', text, createdAt: nowIso() };
        const program = currentProgram();
        const pushHasCableFly = program.days.some((d) => d.exercises.some((e) => e.exerciseId === 'cable-fly'));
        const wantsChange = /skip|swap|replace|cable|fly|don'?t know|change/i.test(text);

        if (wantsChange && pushHasCableFly) {
          const change: CoachChangeProposal = {
            id: nextId('change'),
            status: 'pending',
            createdAt: nowIso(),
            title: 'Swap Cable fly for Pec deck',
            lines: [
              { kind: 'remove', text: 'Cable fly 3×12 (Push)' },
              { kind: 'add', text: 'Pec deck 3×12 (Push)' },
              { kind: 'result', text: 'Push stays at 6 exercises, ~55 min. Same muscles, easier to learn.' },
            ],
            baseProgramVersion: program.version,
          };
          changes.push(change);
          return {
            message,
            reply: {
              id: nextId('msg'),
              role: 'coach',
              text: "You've skipped Cable fly 4 times because you didn't know it. Pec deck works the same muscles and the machine guides the movement. Want me to swap it?",
              createdAt: nowIso(),
              change,
            },
          };
        }
        return {
          message,
          reply: {
            id: nextId('msg'),
            role: 'coach',
            text: "Good question. You're at 87% this block and 6 weeks in a row. Lower body is behind (4 of 8), so I'd prioritise Saturday's Legs session this week.",
            createdAt: nowIso(),
          },
        };
      }),

    applyChange: (changeId) =>
      respond(() => {
        const change = changeFor(changeId);
        if (change.status !== 'pending') throw badRequest('Change is not pending');
        const pecDeck = findExercise('pec-deck')!;
        const days = clone(currentProgram().days).map((d) => ({
          ...d,
          exercises: d.exercises.map((e) =>
            e.exerciseId === 'cable-fly'
              ? { exerciseId: pecDeck.id, name: pecDeck.name, sets: e.sets, reps: e.reps, restSeconds: e.restSeconds, formCue: 'Sit tall, elbows soft. Squeeze for a second when the pads meet.' }
              : e,
          ),
        }));
        const program = addProgramVersion(days, change.title);
        change.status = 'applied';
        change.resultingProgramVersion = program.version;
        refreshUpcomingSessions();
        return { change, program };
      }),

    declineChange: (changeId) =>
      respond(() => {
        const change = changeFor(changeId);
        if (change.status !== 'pending') throw badRequest('Change is not pending');
        change.status = 'declined';
        return { change, program: currentProgram() };
      }),

    // Undo restores the days of the version the change was based on, as a new version.
    undoChange: (changeId) =>
      respond(() => {
        const change = changeFor(changeId);
        if (change.status !== 'applied') throw badRequest('Only applied changes can be undone');
        const base = state.programs.find((p) => p.version === change.baseProgramVersion);
        if (!base) throw notFound('Program version');
        const program = addProgramVersion(base.days, `Undid: ${change.title}`);
        change.status = 'pending';
        delete change.resultingProgramVersion;
        refreshUpcomingSessions();
        return { change, program };
      }),
  };
}

/** Shared instance the app uses. */
export const mockDataSource = createMockDataSource();
