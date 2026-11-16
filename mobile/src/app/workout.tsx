// Workout session (RYR-24). Presented as a full-screen modal.
//
// Everything the user taps updates local state (a per-session draft, see
// src/workout/draft.ts) right away. API writes go through an in-memory queue
// (src/workout/logQueue.ts) that retries when offline, so ticking an exercise
// never waits on the network.
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, useQuery, type ExerciseCatalogEntry, type Session, type SkipReason } from '../api';
import { Button, ExerciseRow, IconButton, StepProgress, type StepState } from '../components';
import { colors, fonts, screenGutter, type } from '../theme';
import { rememberCompletion } from '../workout/completionCache';
import { clearDraft, draftFromSession, getDraft, saveDraft, targetReps, type WorkoutDraft } from '../workout/draft';
import { logQueue } from '../workout/logQueue';
import { RepsSheet, Sheet, SheetOption, SkipSheet, SwapSheet, skipReasonText } from '../workout/sheets';

type Loaded = { kind: 'draft'; draft: WorkoutDraft } | { kind: 'rest' } | { kind: 'finished'; session: Session };

// How long Finish waits for the server before moving on (the call keeps retrying in the background).
const FINISH_WAIT_MS = 4000;

export default function WorkoutScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const { data, error, refetch } = useQuery(async (): Promise<Loaded> => {
    const existing = sessionId ? getDraft(sessionId) : undefined;
    if (existing) return { kind: 'draft', draft: existing };
    const session = sessionId ? await api.getSession(sessionId) : (await api.getToday()).session;
    if (!session) return { kind: 'rest' };
    const draft = getDraft(session.id);
    if (draft) return { kind: 'draft', draft };
    if (session.status === 'done') return { kind: 'finished', session };
    const fresh = draftFromSession(session);
    saveDraft(fresh);
    return { kind: 'draft', draft: fresh };
  }, [sessionId]);

  if (data?.kind === 'draft') return <Workout key={data.draft.sessionId} initial={data.draft} />;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={[styles.topBar, styles.fallbackBar]}>
        <IconButton icon="close" accessibilityLabel="Close workout" onPress={leave} />
      </View>
      <View style={styles.centered}>
        {!data && !error ? (
          <ActivityIndicator color={colors.accent} accessibilityLabel="Loading workout" />
        ) : error ? (
          <>
            <Text style={styles.message}>Couldn't load your workout. Check your connection.</Text>
            <Button label="Try again" variant="secondary" onPress={refetch} />
          </>
        ) : data?.kind === 'rest' ? (
          <Text style={styles.message}>No workout today. Rest up.</Text>
        ) : data?.kind === 'finished' ? (
          <>
            <Text style={styles.message}>You've already finished {data.session.name}.</Text>
            <Button
              label="See summary"
              variant="secondary"
              onPress={() => router.replace({ pathname: '/workout-complete', params: { sessionId: data.session.id } })}
            />
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function ElapsedTimer({ startedAtMs }: { startedAtMs: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const text = formatElapsed(now - startedAtMs);
  const [m, s] = text.split(':').map(Number);
  return (
    <Text style={styles.timer} accessibilityRole="timer" accessibilityLabel={`Elapsed ${m} minutes ${s} seconds`}>
      {text}
    </Text>
  );
}

function restText(seconds: number) {
  if (seconds < 120 || seconds % 60 !== 0) return `${seconds}s`;
  return `${seconds / 60} min`;
}

type RepsTarget = { index: number; setIndex: number; fromDone: boolean };

function Workout({ initial }: { initial: WorkoutDraft }) {
  const [draft, setDraft] = useState(initial);
  const draftRef = useRef(draft);
  const queue = useSyncExternalStore(logQueue.subscribe, logQueue.getStatus);

  const [openRow, setOpenRow] = useState<number | null>(null);
  const [skipIndex, setSkipIndex] = useState<number | null>(null);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [repsTarget, setRepsTarget] = useState<RepsTarget | null>(null);
  const [repsValue, setRepsValue] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const { sessionId, exercises, marks, sets } = draft;

  const update = (fn: (d: WorkoutDraft) => WorkoutDraft) => {
    const next = fn(draftRef.current);
    draftRef.current = next;
    saveDraft(next);
    setDraft(next);
  };

  const current = marks.findIndex((m) => m === null);
  const doneCount = marks.filter((m) => m?.status === 'done').length;
  const skippedCount = marks.filter((m) => m?.status === 'skipped').length;
  const leftCount = exercises.length - doneCount - skippedCount;
  const steps: StepState[] = marks.map((m, i) =>
    m?.status === 'done' ? 'done' : m?.status === 'skipped' ? 'skipped' : i === current ? 'current' : 'todo',
  );
  const anythingLogged = marks.some((m) => m !== null) || sets.some((s) => s.some((v) => v !== null));

  // --- Actions -------------------------------------------------------------

  const announceNext = (afterIndex: number, nextMarks: WorkoutDraft['marks']) => {
    const next = nextMarks.findIndex((m) => m === null);
    const done = exercises[afterIndex]?.name;
    AccessibilityInfo.announceForAccessibility(
      next === -1 ? `${done} logged. All exercises logged.` : `${done} logged. Next: ${draftRef.current.exercises[next].name}.`,
    );
  };

  const completeExercise = (index: number) => {
    const d = draftRef.current;
    const ex = d.exercises[index];
    const logged = d.sets[index].filter((r): r is number => r !== null).map((reps) => ({ reps }));
    const nextMarks = d.marks.map((m, i) => (i === index ? ({ status: 'done' } as const) : m));
    update((prev) => ({ ...prev, marks: nextMarks }));
    logQueue.log(d.sessionId, { action: 'done', exerciseId: ex.exerciseId, ...(logged.length ? { sets: logged } : {}) });
    announceNext(index, nextMarks);
  };

  const setReps = (index: number, setIndex: number, reps: number | null) => {
    update((prev) => ({
      ...prev,
      sets: prev.sets.map((row, i) => (i === index ? row.map((v, j) => (j === setIndex ? reps : v)) : row)),
    }));
  };

  const openRepsSheet = (target: RepsTarget) => {
    const row = draftRef.current.sets[target.index];
    const prevLogged = row.slice(0, target.setIndex).reverse().find((v) => v !== null);
    setRepsValue(row[target.setIndex] ?? prevLogged ?? targetReps(exercises[target.index].reps) ?? 10);
    setRepsTarget(target);
  };

  // Done logs the next set; once every set is logged it completes the exercise.
  const onDone = (index: number) => {
    const row = draftRef.current.sets[index];
    const nextSet = row.findIndex((v) => v === null);
    if (nextSet === -1) {
      completeExercise(index);
      return;
    }
    const reps = targetReps(draftRef.current.exercises[index].reps);
    if (reps === null) {
      // "max" reps: ask how many.
      openRepsSheet({ index, setIndex: nextSet, fromDone: true });
      return;
    }
    setReps(index, nextSet, reps);
    if (nextSet === row.length - 1) completeExercise(index);
  };

  const saveRepsSheet = () => {
    if (!repsTarget) return;
    const { index, setIndex, fromDone } = repsTarget;
    setReps(index, setIndex, repsValue);
    setRepsTarget(null);
    if (fromDone && draftRef.current.sets[index].every((v) => v !== null)) completeExercise(index);
  };

  const skip = (index: number, reason: SkipReason) => {
    const ex = draftRef.current.exercises[index];
    const nextMarks = draftRef.current.marks.map((m, i) => (i === index ? ({ status: 'skipped', reason } as const) : m));
    update((prev) => ({ ...prev, marks: nextMarks }));
    logQueue.log(sessionId, { action: 'skip', exerciseId: ex.exerciseId, reason });
    setSkipIndex(null);
    announceNext(index, nextMarks);
  };

  // Swap replaces the exercise for this session (contract.md); the replacement is then logged as usual.
  const swap = (index: number, alt: ExerciseCatalogEntry) => {
    const ex = draftRef.current.exercises[index];
    update((prev) => ({
      ...prev,
      exercises: prev.exercises.map((e, i) => {
        if (i !== index) return e;
        const { formCue: _cue, ...rest } = e;
        return { ...rest, exerciseId: alt.id, name: alt.name, swappedFromId: e.swappedFromId ?? e.exerciseId };
      }),
      sets: prev.sets.map((row, i) => (i === index ? row.map(() => null) : row)),
    }));
    logQueue.log(sessionId, { action: 'swap', exerciseId: ex.exerciseId, replacementId: alt.id });
    setSwapIndex(null);
    AccessibilityInfo.announceForAccessibility(`Swapped ${ex.name} for ${alt.name}.`);
  };

  const onClose = useCallback(() => {
    if (!anythingLogged) {
      leave();
      return;
    }
    Alert.alert('Leave workout?', "Your progress is saved. You can pick up where you left off.", [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: leave },
    ]);
  }, [anythingLogged]);

  // Android back button behaves like the close button.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const doFinish = async () => {
    setFinishing(true);
    const d = draftRef.current;
    const durationMinutes = Math.min(600, Math.max(0, Math.round((Date.now() - d.startedAtMs) / 60000)));
    const saved = logQueue
      .finish(d.sessionId, { durationMinutes })
      .then((summary) => rememberCompletion(summary))
      .finally(() => clearDraft(d.sessionId));
    // Move on once saved, or after a short wait when offline (the queue keeps retrying).
    await Promise.race([saved.catch(() => {}), new Promise((resolve) => setTimeout(resolve, FINISH_WAIT_MS))]);
    router.replace({ pathname: '/workout-complete', params: { sessionId: d.sessionId } });
  };

  const onFinish = () => {
    if (finishing) return;
    if (leftCount === 0) {
      void doFinish();
      return;
    }
    Alert.alert(
      'Finish workout?',
      `${leftCount} ${leftCount === 1 ? 'exercise is' : 'exercises are'} not logged yet.`,
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Finish', onPress: () => void doFinish() },
      ],
    );
  };

  // --- Render --------------------------------------------------------------

  const hasUpcoming = marks.some((m, i) => m === null && i !== current);
  const swapEx = swapIndex !== null ? exercises[swapIndex] : null;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.topBar}>
          <IconButton icon="close" accessibilityLabel="Close workout" onPress={onClose} />
          <ElapsedTimer startedAtMs={draft.startedAtMs} />
          <IconButton icon="more" accessibilityLabel="More options" onPress={() => setMenuOpen(true)} />
        </View>
        <View style={styles.titleRow}>
          <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
            {draft.sessionName}
          </Text>
          <Text style={styles.count}>
            {doneCount} done · {skippedCount} skipped · {leftCount} left
          </Text>
        </View>
        <StepProgress
          steps={steps}
          accessibilityLabel={`${doneCount} done, ${skippedCount} skipped, ${leftCount} left`}
        />
        {queue.retrying && queue.pending > 0 ? (
          <Text style={styles.sync} accessibilityLiveRegion="polite" onPress={logQueue.retryNow}>
            Offline. {queue.pending} {queue.pending === 1 ? 'change' : 'changes'} will sync when you're back online.
          </Text>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {exercises.map((ex, i) => {
          const mark = marks[i];
          const dose = `${ex.sets} × ${ex.reps}`;
          const key = `${i}-${ex.exerciseId}`;
          if (mark?.status === 'done') return <ExerciseRow key={key} name={ex.name} dose={dose} state="done" />;
          if (mark?.status === 'skipped') {
            return <ExerciseRow key={key} name={ex.name} dose={dose} state="skipped" skipReason={skipReasonText(mark.reason)} />;
          }
          if (i === current) {
            const repsLabel = ex.reps === 'max' ? 'max reps' : `${ex.reps} reps`;
            return (
              <ExerciseRow
                key={key}
                name={ex.name}
                dose={dose}
                state="active"
                detail={`${ex.sets} sets × ${repsLabel} · rest ${restText(ex.restSeconds)}`}
                cue={ex.formCue}
                sets={sets[i]}
                onSetPress={(setIndex) => openRepsSheet({ index: i, setIndex, fromDone: false })}
                onDone={() => onDone(i)}
                onSkip={() => setSkipIndex(i)}
                onSwap={() => setSwapIndex(i)}
              />
            );
          }
          return (
            <ExerciseRow
              key={key}
              name={ex.name}
              dose={dose}
              state="todo"
              onSkip={() => setSkipIndex(i)}
              onSwap={() => setSwapIndex(i)}
              actionsOpen={openRow === i}
              onActionsOpenChange={(open) => setOpenRow(open ? i : null)}
            />
          );
        })}
        {hasUpcoming ? <Text style={styles.hint}>Swipe an exercise left to skip or swap it.</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={finishing ? 'Saving…' : 'Finish workout'}
          variant={leftCount === 0 ? 'primary' : 'secondary'}
          disabled={finishing}
          onPress={onFinish}
        />
      </View>

      <SkipSheet
        exerciseName={skipIndex !== null ? exercises[skipIndex].name : null}
        onPick={(reason) => skipIndex !== null && skip(skipIndex, reason)}
        onClose={() => setSkipIndex(null)}
      />
      <SwapSheet
        exercise={swapEx ? { exerciseId: swapEx.exerciseId, name: swapEx.name } : null}
        excludeIds={exercises.map((e) => e.exerciseId)}
        onPick={(alt) => swapIndex !== null && swap(swapIndex, alt)}
        onClose={() => setSwapIndex(null)}
      />
      <RepsSheet
        target={
          repsTarget
            ? {
                exerciseName: exercises[repsTarget.index].name,
                setIndex: repsTarget.setIndex,
                logged: sets[repsTarget.index][repsTarget.setIndex] !== null,
              }
            : null
        }
        value={repsValue}
        onChange={setRepsValue}
        onSave={saveRepsSheet}
        onClear={() => {
          if (repsTarget) setReps(repsTarget.index, repsTarget.setIndex, null);
          setRepsTarget(null);
        }}
        onClose={() => setRepsTarget(null)}
      />
      <Sheet visible={menuOpen} title={draft.sessionName} onClose={() => setMenuOpen(false)}>
        <View style={styles.menu}>
          <SheetOption icon="check" tone="accent" label="End workout"
            detail="Save what you've logged and finish"
            onPress={() => {
              setMenuOpen(false);
              // Let the sheet close first: iOS won't show an alert while a modal is dismissing.
              setTimeout(onFinish, 350);
            }}
          />
          <SheetOption
            icon="close"
            label="Leave for now"
            detail="Your progress is kept"
            onPress={() => {
              setMenuOpen(false);
              leave();
            }}
          />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    gap: 12,
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: screenGutter,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fallbackBar: { paddingTop: 16, paddingHorizontal: screenGutter },
  timer: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  title: { ...type.screenTitle, color: colors.text, flexShrink: 1 },
  count: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  sync: { ...type.caption, color: colors.attention },
  list: { gap: 8, paddingVertical: 16, paddingHorizontal: screenGutter },
  hint: { ...type.caption, marginTop: 2, color: colors.textTertiary },
  footer: { paddingTop: 8, paddingBottom: 12, paddingHorizontal: screenGutter },
  menu: { gap: 8 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: screenGutter },
  message: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
});
