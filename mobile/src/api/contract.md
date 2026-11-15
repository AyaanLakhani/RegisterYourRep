# API contract: `/api/v1` (RYR-30)

The endpoints the mobile app needs for the new data model (Product Plan §5).
Schema names refer to the zod schemas in [`schemas.ts`](./schemas.ts). The app
validates every response against them (`http.ts`), so the server should treat
this file and `schemas.ts` as the shape it must return.

Conventions:

- All paths are prefixed with `/api/v1`. Bodies are JSON.
- Timestamps are ISO 8601 strings. Calendar days are `YYYY-MM-DD` in the user's local time.
- Ids are opaque strings (Mongo ObjectIds as strings).
- Errors return a non-2xx status with `ApiErrorBody` (`{ "error": string }`), the same as today's `withAuth`.
  Used statuses: 400 invalid input, 401 not authenticated, 404 not found (including other users' data),
  409 conflict (e.g. generation already running), 429 rate limited, 503 DB unavailable.
- Request bodies are validated server-side with the same zod schemas (`*RequestSchema`, `ProfileInputSchema`).

## Endpoints

| # | Method | Path | Request | Response | `DataSource` method |
|---|---|---|---|---|---|
| **Profile** |
| 1 | GET | `/profile` | – | `Profile` or `null` (before onboarding); optional `displayName` from the account | `getProfile()` |
| 2 | PUT | `/profile` | `ProfileInput` | `Profile` (new version; stores `suggestedLevel` and the confirmed `level`) | `saveProfile(input)` |
| 3 | GET | `/catalog/familiarity?equipment=dumbbell,bench` | – | `ExerciseCatalogEntry[]` (onboarding "which do you know?" list, only exercises the confirmed equipment allows; all when `equipment` is omitted) | `getFamiliarityOptions(equipment?)` |
| **Generation** |
| 4 | POST | `/generation-jobs` | `{}` (uses the current profile) | `GenerationJob` (202) | `startGeneration()` |
| 5 | GET | `/generation-jobs/:jobId` | – | `GenerationJob` (poll every ~1 s until `done` / `failed`) | `getGenerationJob(jobId)` |
| 6 | GET | `/proposals/:proposalId` | – | `ProgramProposal` | `getProposal(proposalId)` |
| 7 | POST | `/proposals/:proposalId/accept` | `AcceptProposalRequest` | `Program` (new current version) | `acceptProposal(proposalId, body)` |
| **Program** |
| 8 | GET | `/program` | – | `ProgramWithVersions` (current + version list, newest first) | `getProgram()` |
| 9 | GET | `/program/versions/:version` | – | `Program` | `getProgramVersion(version)` |
| 10 | POST | `/program/day-moves` | `SaveDayMovesRequest` | `Program` (new version) | `saveDayMoves(body)` |
| **Today, weeks, sessions** |
| 11 | GET | `/today` | – | `Today` (`session` is `null` on rest days; `lastWeekMissedSessions` > 0 shows the missed-week prompt) | `getToday()` |
| 12 | GET | `/weeks/current` | – | `Week` | `getCurrentWeek()` |
| 13 | GET | `/weeks/:startDate` | – (`startDate` = any day; server snaps to Monday) | `Week` | `getWeek(startDate)` |
| 14 | GET | `/sessions/:sessionId` | – | `Session` | `getSession(sessionId)` |
| 15 | POST | `/sessions/:sessionId/move` | `MoveSessionRequest` | `Week` (the updated week) | `moveSession(sessionId, toDate)` |
| 16 | POST | `/sessions/:sessionId/logs` | `LogExerciseRequest` (`done` / `skip` + reason / `swap`) | `Session` | `logExercise(sessionId, body)` |
| 17 | POST | `/sessions/:sessionId/finish` | `FinishSessionRequest` | `SessionCompletionSummary` | `finishSession(sessionId, body?)` |
| **Progress** |
| 18 | GET | `/progress` | – | `ProgressStats` | `getProgress()` |
| **Catalog** |
| 19 | GET | `/catalog/:exerciseId/alternatives` | – | `ExerciseCatalogEntry[]` (swap options) | `getAlternatives(exerciseId)` |
| **Coach** |
| 20 | POST | `/coach/messages` | `SendCoachMessageRequest` | `CoachReply` (`reply.change` holds a proposed `CoachChangeProposal`, if any) | `sendCoachMessage(body)` |
| 21 | POST | `/coach/changes/:changeId/apply` | `{}` | `CoachChangeResult` (new program version) | `applyChange(changeId)` |
| 22 | POST | `/coach/changes/:changeId/decline` | `{}` | `CoachChangeResult` | `declineChange(changeId)` |
| 23 | POST | `/coach/changes/:changeId/undo` | `{}` | `CoachChangeResult` | `undoChange(changeId)` |

### Behaviour notes

- **Versioning.** Profiles and programs are append-only. Any change (saving the profile, accepting a
  proposal, day moves, applying or undoing a coach change) creates a new version; the previous program
  becomes `archived`. Sessions keep the `programVersion` they were generated from.
- **Generation (4–7).** One running job per user (409 otherwise) and the existing per-user rate limit
  (RYR-5, 429). `steps` always lists the four steps in order: `reading_answers`, `picking_exercises`,
  `balancing_muscles`, `setting_sets_reps`. `proposalId` is set once `status` is `done`; `error` is a
  client-safe message when `failed`. Accepting creates the program and the sessions of the active week.
- **Day moves (10).** Changes which weekday each training day falls on. Applies from next week; the
  active week keeps its dates (use 15 to move a single session this week). Returns 400 if two training
  days land on the same weekday.
- **Move session (15).** Only within the active week, only for sessions that are not finished, and not
  onto a day that already has a session. The session's `date` changes, `status` becomes `moved` and
  `movedFrom` keeps the original date.
- **Log exercise (16).** Re-logging an exercise replaces its previous log. `swap` replaces the planned
  exercise for this session only (sets/reps/rest are kept, `swappedFromId` records the original); the
  user then logs the replacement as `done` or `skip`. The first log sets `startedAt`.
- **Finish (17).** Sets `status: done` and `finishedAt`. `durationMinutes` defaults to
  `finishedAt - startedAt`. `repeatSkipNudge` is set when an exercise skipped in this session has now
  been skipped 2+ times overall, otherwise `null`.
- **Progress (18).** `completionPercent = round(sessionsDone / sessionsPlanned * 100)` over the current
  program block. `muscleBalance` compares sets per group (upper/lower/core) this week with the target.
  Optional `muscleDetail` gives the same comparison per muscle (for "See every muscle").
  `mostSkipped` is sorted by count, with the most common reason. `levelUpReady` drives the
  "ready for harder?" card.
- **Coach (20–23).** Apply and decline require `status: pending` (400 otherwise). Undo requires
  `applied` or `declined` (400 otherwise). Undoing an applied change creates a new program version that
  restores the days of `baseProgramVersion` and puts the change back to `pending`. Undoing a declined
  change only puts it back to `pending` (no new version; `program` is the current one). Applying a change also refreshes untouched upcoming sessions in the
  active week.

## Auth

The app signs in with Privy and sends the Privy access token on every request:

```
Authorization: Bearer <Privy access token>
```

Today the server only reads the iron-session cookie: `withAuth` in `lib/apiHandler.js` calls
`getSession()` and takes `session.privyUserId`, and the cookie is only created by
`POST /api/auth/privy` after `verifyPrivyToken(token)`. A native app has no cookie jar we want to rely
on, so the server needs to accept the bearer token directly. Proposed change (not part of this PR):

1. In `withAuth`, before reading the session: if the request has `Authorization: Bearer <token>`, call
   `verifyPrivyToken(token)` (the same helper `/api/auth/privy` uses, which checks signature, issuer,
   audience/app id and expiry) and use the returned user id as `privyUserId`.
2. If the header is present but the token is invalid or expired, return 401 `{ "error": "Not authenticated" }`.
   Do not fall back to the cookie in that case.
3. If there is no header, keep today's cookie path, so the web app is unaffected.
4. Make sure a `User` document exists for bearer-only users (the upsert `/api/auth/privy` does today),
   e.g. on `PUT /profile` or lazily in `withAuth`.
5. Never log the token. Cache Privy's verification key (JWKS) rather than fetching it per request.
6. The bearer path doesn't use cookies, so it needs no CSRF protection. The cookie path keeps whatever
   protection the web app has.

The mobile side is already in place: `setTokenProvider()` in `client.ts` supplies the token and
`apiFetch` adds the header.

## Mapping from today's models

| Today (`lib/models/index.js`) | New | Notes |
|---|---|---|
| `User` fields `fitnessLevel`, `targetMuscles`, `frequency`, `sessionDuration`, `preferences` | `Profile` (versioned) | `frequency` → `trainingDays` (actual weekdays); `sessionDuration` → `sessionMinutes`; `fitnessLevel` → `level` (suggested by the app, confirmed by the user) plus `suggestedLevel` and `trainingHistory`; `targetMuscles` + `preferences` → `goals` + `limitations`; new: `gymType`, `equipment` (the confirmed list), `trainingHistory`, `familiarExerciseIds`, `suggestedLevel`. `User` keeps identity (`privyUserId`, `email`, `onboardingComplete`). |
| `WorkoutPlan` | `Program` (versioned) | `generatedPlan` (Mixed) becomes typed `days[]` with catalog ids; `status: draft/generating/ready/failed` splits into `GenerationJob.status` (pending/running/done/failed) and `Program.status` (current/archived). `name` stays; new: `version`, `note`, `profileVersion`. The fitness fields copied onto each plan move to `Profile`. |
| (implicit in `WorkoutPlan.status` + `GenerationLog`) | `GenerationJob`, `ProgramProposal` | `GenerationLog` stays as the rate-limit log. The proposal holds both options until one is accepted. |
| `Workcard` | `Session` | `date`, `weekday`, `dayLabel` → `name`, `focus`, `exercises` (now with `exerciseId`, `formCue`; `notes` → `formCue`). `checked[]` + `completedCount` / `totalCount` / `score` are replaced by `logs` (derived counts). `status: pending/submitted` → `scheduled/done/skipped/moved/carried_over`; `submittedAt` → `finishedAt`. `planId` → `programId` + `programVersion`. |
| `Workout` | `ExerciseLog` (embedded in `Session.logs`) | Today a `Workout` is a flat list of completed exercise names saved on submit. Now each exercise gets a log with `done`/`skipped`, a skip reason and (later) per-set reps/weight. `completionScore` etc. are derived. |
| – | `Week` | New. Groups the sessions of one Monday–Sunday week and carries the summary. Can be stored or computed from sessions. |
| – | `ExerciseCatalogEntry` | New. Exercises today are free-text names from Gemini; the catalog gives stable ids, muscles, equipment and alternatives. Generation must pick from it. |
| – | `ProgressStats` | New, computed from sessions and logs. |
| – | `CoachMessage`, `CoachChangeProposal` | New. |

Existing routes (`/api/workout-plans`, `/api/workcards`, `/api/workouts`, `/api/user/profile`) stay as
they are for the web app. `/api/v1` is new and only used by the mobile app until the web app moves over.

## Gym type and level (decided 2026-11-15)

From Questions & Decisions, "How does the coach tell beginner, intermediate and pro apart?". Rules live in code
(`src/api/level.ts`); the server should apply the same ones.

- **Gym type** is one of `home`, `apartment_gym`, `community_center`, `commercial_gym`. Each pre-ticks a preset
  equipment list (`GYM_TYPE_PRESETS`). The user unticks what theirs lacks, and the **confirmed list** is saved as
  `equipment`. Plan generation uses `equipment`, never the gym type alone.
- **Equipment filter**: an exercise is possible when every piece of kit it needs is in `equipment`; bodyweight is
  always possible (`canDoWith`). The familiarity endpoint and plan generation both apply it.
- **Level** is `beginner`, `intermediate` or `pro`. The app suggests one from `trainingHistory` and the number of
  familiarity ticks (`suggestLevel`), shows "we'll start you as …", and the user confirms or changes it. The profile
  stores both `suggestedLevel` and the confirmed `level`; plans use `level`. There is no plain level dropdown.
- Pro users still get a generated plan, which they tweak through Plan and Ask Coach.
