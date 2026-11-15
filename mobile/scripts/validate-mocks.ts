// Checks that every mock object matches its zod schema (RYR-30).
//
//   npm run validate:mocks
//
// Parses the static catalog and seed, then calls every DataSource method on a
// fresh mock (including the mutations) and parses each response.
import type { z } from 'zod';
import { catalog } from '../src/api/mock/catalog';
import { createMockDataSource } from '../src/api/mock';
import { createSeed } from '../src/api/mock/seed';
import * as S from '../src/api/schemas';

let failures = 0;
let checks = 0;

function check<T>(label: string, schema: z.ZodType<T>, value: unknown): T {
  checks++;
  const result = schema.safeParse(value);
  if (!result.success) {
    failures++;
    console.error(`FAIL ${label}`);
    for (const issue of result.error.issues.slice(0, 5)) {
      console.error(`  ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    return value as T;
  }
  return result.data;
}

function expect(label: string, condition: boolean) {
  checks++;
  if (!condition) {
    failures++;
    console.error(`FAIL ${label}`);
  }
}

async function main() {
  // Static data
  for (const entry of catalog) check(`catalog ${entry.id}`, S.ExerciseCatalogEntrySchema, entry);
  const ids = new Set(catalog.map((e) => e.id));
  for (const entry of catalog) {
    for (const alt of entry.alternatives) expect(`catalog ${entry.id} alternative ${alt} exists`, ids.has(alt));
  }
  const seed = createSeed();
  check('seed profile', S.ProfileSchema, seed.profile);
  for (const p of seed.programs) check(`seed program v${p.version}`, S.ProgramSchema, p);
  for (const s of seed.sessions) check(`seed session ${s.id}`, S.SessionSchema, s);
  check('seed progress', S.ProgressStatsSchema, seed.progress);

  // Every DataSource method
  let clock = Date.parse('2026-11-12T17:30:00.000Z');
  const api = createMockDataSource({ delayMs: 0, generationStepMs: 1000, now: () => new Date(clock) });

  check('getProfile', S.ProfileSchema.nullable(), await api.getProfile());
  check('getFamiliarityOptions', S.ExerciseCatalogEntrySchema.array().length(10), await api.getFamiliarityOptions());

  const today = check('getToday', S.TodaySchema, await api.getToday());
  expect('today is Thu Nov 12 Push', today.session?.name === 'Push' && today.session.exercises.length === 6);
  expect('no missed-week prompt by default', today.lastWeekMissedSessions === undefined);
  api.setMissedLastWeek(3);
  const missed = check('getToday (missed last week)', S.TodaySchema, await api.getToday());
  expect('missed-week flag reported', missed.lastWeekMissedSessions === 3);
  api.setMissedLastWeek(0);
  const week = check('getCurrentWeek', S.WeekSchema, await api.getCurrentWeek());
  expect('week summary 2 of 5 done, 11 done / 1 skipped', week.summary.sessionsDone === 2 && week.summary.sessionsPlanned === 5 && week.summary.exercisesDone === 11 && week.summary.exercisesSkipped === 1);
  check('getWeek past', S.WeekSchema, await api.getWeek('2026-10-12'));
  check('getWeek future', S.WeekSchema, await api.getWeek('2026-11-16'));
  check('getWeek active (mid-week date)', S.WeekSchema, await api.getWeek('2026-11-11'));

  const program = check('getProgram', S.ProgramWithVersionsSchema, await api.getProgram());
  expect('program is v2 with 2 versions', program.current.version === 2 && program.versions.length === 2);
  check('getProgramVersion(1)', S.ProgramSchema, await api.getProgramVersion(1));
  const progress = check('getProgress', S.ProgressStatsSchema, await api.getProgress());
  expect('progress 87% 26/30 streak 6', progress.completionPercent === 87 && progress.sessionsDone === 26 && progress.sessionsPlanned === 30 && progress.streakWeeks === 6);

  check('getAlternatives(cable-fly)', S.ExerciseCatalogEntrySchema.array().min(1), await api.getAlternatives('cable-fly'));

  // Workout flow
  const sessionId = today.session!.id;
  check('getSession', S.SessionSchema, await api.getSession(sessionId));
  check('logExercise done', S.SessionSchema, await api.logExercise(sessionId, { action: 'done', exerciseId: 'bench-press', sets: [{ reps: 8, weightKg: 60 }] }));
  check('logExercise swap', S.SessionSchema, await api.logExercise(sessionId, { action: 'swap', exerciseId: 'incline-dumbbell-press', replacementId: 'dumbbell-bench-press' }));
  check('logExercise skip', S.SessionSchema, await api.logExercise(sessionId, { action: 'skip', exerciseId: 'cable-fly', reason: 'didnt_know' }));
  for (const id of ['dumbbell-bench-press', 'overhead-triceps-extension', 'dips', 'lateral-raise']) {
    await api.logExercise(sessionId, { action: 'done', exerciseId: id });
  }
  clock += 55 * 60000;
  const summary = check('finishSession', S.SessionCompletionSummarySchema, await api.finishSession(sessionId, { durationMinutes: 54 }));
  expect('finish: 5 of 6, nudge for Cable fly', summary.exercisesDone === 5 && summary.exercisesTotal === 6 && summary.repeatSkipNudge?.exerciseId === 'cable-fly');

  check('moveSession', S.WeekSchema, await api.moveSession('session-2026-11-13', '2026-11-15'));

  // Program edits
  const moved = check('saveDayMoves', S.ProgramSchema, await api.saveDayMoves({ moves: [{ from: 'sat', to: 'sun' }] }));
  expect('day moves create v3', moved.version === 3);

  // Coach
  const reply = check('sendCoachMessage', S.CoachReplySchema, await api.sendCoachMessage({ text: 'I keep skipping cable fly' }));
  const changeId = reply.reply.change?.id;
  expect('coach proposes a change', !!changeId);
  check('sendCoachMessage (no change)', S.CoachReplySchema, await api.sendCoachMessage({ text: 'How am I doing?' }));
  if (changeId) {
    check('applyChange', S.CoachChangeResultSchema, await api.applyChange(changeId));
    check('undoChange', S.CoachChangeResultSchema, await api.undoChange(changeId));
    check('declineChange', S.CoachChangeResultSchema, await api.declineChange(changeId));
  }

  // Onboarding + generation
  check('saveProfile', S.ProfileSchema, await api.saveProfile({
    goals: ['build_muscle'],
    trainingDays: ['mon', 'tue', 'thu', 'fri', 'sat'],
    sessionMinutes: 50,
    gymType: 'full_gym',
    equipment: ['barbell', 'dumbbell', 'cable', 'machine'],
    familiarExerciseIds: ['squat', 'bench-press'],
    limitations: 'Left knee is sore on deep squats',
  }));
  const job = check('startGeneration', S.GenerationJobSchema, await api.startGeneration());
  clock += 1500;
  check('getGenerationJob running', S.GenerationJobSchema, await api.getGenerationJob(job.id));
  clock += 5000;
  const done = check('getGenerationJob done', S.GenerationJobSchema, await api.getGenerationJob(job.id));
  expect('generation done with proposal', done.status === 'done' && !!done.proposalId);
  const proposal = check('getProposal', S.ProgramProposalSchema, await api.getProposal(done.proposalId!));
  check('acceptProposal', S.ProgramSchema, await api.acceptProposal(proposal.id, { choice: 'recommended' }));
  check('getProgram after edits', S.ProgramWithVersionsSchema, await api.getProgram());
  check('getToday after edits', S.TodaySchema, await api.getToday());
  check('getProgress after edits', S.ProgressStatsSchema, await api.getProgress());

  if (failures) {
    console.error(`\n${failures} of ${checks} checks failed`);
    process.exit(1);
  }
  console.log(`All ${checks} mock checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
