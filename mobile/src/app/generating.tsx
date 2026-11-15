// Building your plan (RYR-21).
//
// Generation runs in the background on the server. This screen polls the job
// about once a second, shows its 4-step checklist, and moves on to the
// proposal when the job is done. Polling pauses while the app is in the
// background and resumes (immediately) when it comes back; network errors back
// off and keep trying, so losing signal doesn't end the run.
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, ApiError, type GenerationJob, type GenerationStep } from '../api';
import { Button, Icon } from '../components';
import { ShimmerBlock, ShimmerText } from '../components/Shimmer';
import { colors, fonts, radius } from '../theme';

const POLL_MS = 1000;
const MAX_BACKOFF_MS = 8000;
const GENERIC_FAILURE =
  "I couldn't finish your plan this time. Your answers are saved, so trying again only takes a moment.";

type StepView = 'done' | 'current' | 'waiting';

function stepViews(job: GenerationJob): StepView[] {
  let current = job.steps.findIndex((s) => s.status === 'running');
  if (current === -1 && job.status !== 'done') current = job.steps.findIndex((s) => s.status !== 'done');
  return job.steps.map((s, i) => (s.status === 'done' ? 'done' : i === current ? 'current' : 'waiting'));
}

function startErrorMessage(err: unknown) {
  if (err instanceof ApiError && err.status === 409) return 'A plan is already being built. Give it a moment and try again.';
  if (err instanceof ApiError && err.status === 429) return "You've built a few plans in a row. Wait a minute, then try again.";
  return "I couldn't start building your plan. Check your connection and try again.";
}

export default function GeneratingScreen() {
  const params = useLocalSearchParams<{ jobId?: string }>();
  const jobId = typeof params.jobId === 'string' && params.jobId.length > 0 ? params.jobId : undefined;

  const [job, setJob] = useState<GenerationJob>();
  const [failure, setFailure] = useState<string>();
  const [starting, setStarting] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const startingRef = useRef(false);

  // Starts a new job and puts its id in the URL, which (re)starts polling.
  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setFailure(undefined);
    setJob(undefined);
    try {
      const next = await api.startGeneration();
      setJob(next);
      router.setParams({ jobId: next.id });
    } catch (err) {
      setFailure(startErrorMessage(err));
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, []);

  // Opened without a job (e.g. a deep link): start one.
  useEffect(() => {
    if (!jobId) start();
  }, [jobId, start]);

  // Poll the job until it is done or failed.
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    let networkErrors = 0;
    let active = AppState.currentState !== 'background';

    const schedule = () => {
      if (cancelled || !active) return;
      const delay = networkErrors === 0 ? POLL_MS : Math.min(POLL_MS * 2 ** networkErrors, MAX_BACKOFF_MS);
      timer = setTimeout(poll, delay);
    };

    async function poll() {
      timer = undefined;
      inFlight = true;
      try {
        const next = await api.getGenerationJob(jobId!);
        if (cancelled) return;
        networkErrors = 0;
        setReconnecting(false);
        setJob(next);
        if (next.status === 'done') {
          if (next.proposalId) router.replace({ pathname: '/proposal', params: { proposalId: next.proposalId } });
          else setFailure(GENERIC_FAILURE);
          return;
        }
        if (next.status === 'failed') {
          setFailure(next.error || GENERIC_FAILURE);
          return;
        }
      } catch (err) {
        if (cancelled) return;
        // The job is gone (or isn't ours): nothing to wait for.
        if (err instanceof ApiError && err.status === 404) {
          setFailure(GENERIC_FAILURE);
          return;
        }
        networkErrors += 1;
        if (networkErrors >= 2) setReconnecting(true);
      } finally {
        inFlight = false;
      }
      schedule();
    }

    const sub = AppState.addEventListener('change', (state) => {
      const nowActive = state === 'active';
      if (nowActive && !active) {
        active = true;
        if (timer) clearTimeout(timer);
        timer = undefined;
        if (!inFlight) poll();
      } else if (state === 'background') {
        active = false;
        if (timer) clearTimeout(timer);
        timer = undefined;
      }
    });

    setFailure(undefined);
    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [jobId]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.main}>
        <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Icon name="coach" size={28} color={colors.accent} />
        </View>

        {failure ? (
          <View style={styles.intro} accessibilityLiveRegion="assertive">
            <Text style={[styles.heading, styles.headingStatic]} accessibilityRole="header">
              That didn't work
            </Text>
            <Text style={styles.helper}>{failure}</Text>
          </View>
        ) : (
          <>
            <View style={styles.intro}>
              <ShimmerText
                style={styles.heading}
                baseColor={colors.textTertiary}
                highlightColor={colors.text}
                accessibilityRole="header"
              >
                Building your plan…
              </ShimmerText>
              <Text style={styles.helper}>Using the exercises you know and the days you can train.</Text>
            </View>

            <View style={styles.steps} accessibilityRole="list" accessibilityLabel="Progress">
              {job && job.steps.map((step, i) => <StepRow key={step.id} step={step} view={stepViews(job)[i]} />)}
            </View>

            {reconnecting && (
              <Text style={styles.reconnecting} accessibilityLiveRegion="polite">
                Lost connection. Still building, reconnecting…
              </Text>
            )}

            <View style={styles.skeletons}>
              <ShimmerBlock height={64} borderRadius={radius.lg} />
              <ShimmerBlock height={64} borderRadius={radius.lg} />
              <ShimmerBlock height={64} borderRadius={radius.lg} />
            </View>
          </>
        )}
      </View>

      {failure && (
        <View style={styles.footer}>
          <Button label={starting ? 'Starting…' : 'Try again'} onPress={start} disabled={starting} />
          <Button label="Change my answers" variant="text" size="sm" onPress={() => router.replace('/onboarding')} />
        </View>
      )}
    </SafeAreaView>
  );
}

const STATUS_TEXT: Record<StepView, string> = { done: 'done', current: 'in progress', waiting: 'waiting' };

function StepRow({ step, view }: { step: GenerationStep; view: StepView }) {
  return (
    <View style={styles.stepRow} accessible accessibilityLabel={`${step.label}, ${STATUS_TEXT[view]}`}>
      {view === 'done' ? (
        <View style={[styles.marker, styles.markerDone]}>
          <Icon name="check" size={14} strokeWidth={3} color={colors.background} />
        </View>
      ) : (
        <View style={[styles.marker, view === 'current' ? styles.markerCurrent : styles.markerWaiting]} />
      )}
      <View style={styles.stepText}>
        {view === 'current' ? (
          <ShimmerText style={[styles.stepLabel, styles.stepLabelCurrent]} baseColor={colors.textSecondary} highlightColor={colors.text}>
            {step.label}
          </ShimmerText>
        ) : (
          <Text style={[styles.stepLabel, view === 'done' ? styles.stepLabelDone : styles.stepLabelWaiting]}>{step.label}</Text>
        )}
      </View>
    </View>
  );
}

const MARKER = 24;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  main: { flex: 1, gap: 22, paddingTop: 40, paddingHorizontal: 24, paddingBottom: 16 },

  badge: {
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },

  intro: { gap: 8 },
  heading: { fontFamily: fonts.display, fontSize: 30, lineHeight: 35 },
  headingStatic: { color: colors.text },
  helper: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.textSecondary },

  // Reserve the checklist's height so nothing jumps when the first poll lands.
  steps: { gap: 14, minHeight: MARKER * 4 + 14 * 3 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  marker: { width: MARKER, height: MARKER, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  markerDone: { backgroundColor: colors.done },
  markerCurrent: { borderWidth: 2, borderColor: colors.accent },
  markerWaiting: { borderWidth: 2, borderColor: colors.borderStrong },
  stepText: { flexShrink: 1 },
  stepLabel: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20 },
  stepLabelDone: { color: colors.textMuted },
  stepLabelCurrent: { fontFamily: fonts.semibold },
  stepLabelWaiting: { color: colors.textTertiary },

  reconnecting: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.attention },

  skeletons: { gap: 10, marginTop: 4 },

  footer: { paddingTop: 12, paddingHorizontal: 24, paddingBottom: 16, gap: 4 },
});
