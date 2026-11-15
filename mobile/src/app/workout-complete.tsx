// Workout complete (RYR-25). Shown after Finish workout; the back gesture is
// disabled in the root layout.
//
// The summary comes from `api.finishSession` (handed over by the workout
// screen via src/workout/completionCache.ts). When it isn't there, it is
// rebuilt from the saved session, its week and progress stats.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, useQuery, type RepeatSkipNudge, type SessionCompletionSummary } from '../api';
import { Button, CoachAvatar, Icon, StatTile } from '../components';
import { colors, fonts, radius, screenGutter, type } from '../theme';
import { getRememberedCompletion } from '../workout/completionCache';

type Loaded = { kind: 'summary'; summary: SessionCompletionSummary } | { kind: 'pending' } | { kind: 'none' };

const POLL_MS = 3000;

async function loadSummary(sessionId: string | undefined): Promise<Loaded> {
  const id = sessionId ?? (await api.getToday()).session?.id;
  if (!id) return { kind: 'none' };
  const remembered = getRememberedCompletion(id);
  if (remembered) return { kind: 'summary', summary: remembered };

  const session = await api.getSession(id);
  // Finish may still be waiting to sync.
  if (session.status !== 'done') return { kind: 'pending' };
  const [week, progress] = await Promise.all([api.getWeek(session.date), api.getProgress()]);

  const durationMinutes =
    session.startedAt && session.finishedAt
      ? Math.max(0, Math.round((Date.parse(session.finishedAt) - Date.parse(session.startedAt)) / 60000))
      : session.estimatedMinutes;

  let repeatSkipNudge: RepeatSkipNudge | null = null;
  for (const log of session.logs) {
    if (log.status !== 'skipped') continue;
    const entry = progress.mostSkipped.find((m) => m.exerciseId === log.exerciseId);
    if (entry && entry.count >= 2) {
      repeatSkipNudge = {
        exerciseId: entry.exerciseId,
        name: entry.name,
        reason: log.reason,
        count: entry.count,
        message: `You skipped ${entry.name.toLowerCase()} again. Want me to swap it for something you know?`,
      };
      break;
    }
  }

  return {
    kind: 'summary',
    summary: {
      session,
      exercisesDone: session.logs.filter((l) => l.status === 'done').length,
      exercisesTotal: session.exercises.length,
      durationMinutes,
      streakWeeks: progress.streakWeeks,
      sessionsThisWeek: { done: week.summary.sessionsDone, planned: week.summary.sessionsPlanned },
      repeatSkipNudge,
    },
  };
}

function goHome() {
  // Back to the tabs (Home) underneath this modal, or Home if there is nothing to go back to.
  router.dismissTo('/');
}

/** null until the setting has been read. */
function useReduceMotion(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => mounted && setEnabled(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setEnabled);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return enabled;
}

export default function WorkoutCompleteScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const { data, error, refetch } = useQuery(() => loadSummary(sessionId), [sessionId]);

  // Keep checking while the finish is syncing (or we couldn't reach the server).
  // Sticky, so the message doesn't flicker while each re-check is in flight.
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (data?.kind === 'pending' || error) setStalled(true);
  }, [data, error]);
  const waiting = stalled && data?.kind !== 'summary' && data?.kind !== 'none';
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(refetch, POLL_MS);
    return () => clearInterval(id);
  }, [waiting, refetch]);

  if (data?.kind === 'summary') return <Celebration summary={data.summary} />;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.centered}>
        {waiting ? (
          <>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.message} accessibilityLiveRegion="polite">
              Saving your workout. It's kept on this phone and will sync when you're back online.
            </Text>
          </>
        ) : data?.kind === 'none' ? (
          <Text style={styles.message}>There's no finished workout to show.</Text>
        ) : (
          <ActivityIndicator color={colors.accent} accessibilityLabel="Loading" />
        )}
      </View>
      <View style={styles.footer}>
        <Button label="Back to Home" onPress={goHome} />
      </View>
    </SafeAreaView>
  );
}

function Celebration({ summary }: { summary: SessionCompletionSummary }) {
  const reduceMotion = useReduceMotion();
  const [burst, setBurst] = useState(0);
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion === null) return;
    if (reduceMotion) {
      pop.setValue(1);
      return;
    }
    Animated.timing(pop, { toValue: 1, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  }, [reduceMotion, pop]);

  const { session, exercisesDone, exercisesTotal, durationMinutes, streakWeeks, sessionsThisWeek, repeatSkipNudge } =
    summary;
  const nudge = repeatSkipNudge;

  const askCoach = () => {
    if (!nudge) return;
    const prefill = `I keep skipping ${nudge.name}. Can you swap it for something I know?`;
    router.replace({ pathname: '/coach', params: { prefill } });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {reduceMotion === false ? <Confetti burst={burst} /> : null}
      <ScrollView contentContainerStyle={styles.main} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[
            styles.badge,
            {
              opacity: pop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] }),
              transform: [{ scale: pop.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.4, 1.08, 1] }) }],
            },
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Icon name="check" size={44} strokeWidth={3} color={colors.background} />
        </Animated.View>

        <View style={styles.headings}>
          <Text style={styles.title} accessibilityRole="header">
            {session.name} done
          </Text>
          <Text style={styles.subtitle}>
            That's {sessionsThisWeek.done} of {sessionsThisWeek.planned} sessions this week.
          </Text>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <StatTile variant="inline" value={`${exercisesDone}/${exercisesTotal}`} label="exercises" />
          </View>
          <View style={styles.stat}>
            <StatTile variant="inline" value={`${durationMinutes} min`} label="duration" />
          </View>
          <View style={styles.stat}>
            <StatTile variant="inline" value={String(streakWeeks)} label="week streak" />
          </View>
        </View>

        {nudge ? (
          <View style={styles.nudge}>
            <CoachAvatar size={32} />
            <View style={styles.nudgeBody}>
              <Text style={styles.nudgeText}>{nudge.message}</Text>
              <Pressable
                onPress={askCoach}
                accessibilityRole="link"
                accessibilityHint="Opens Ask Coach with the swap request filled in"
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Text style={styles.nudgeLink}>Swap it with Coach</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Back to Home" onPress={goHome} />
        {reduceMotion === false ? (
          <Pressable
            onPress={() => setBurst((b) => b + 1)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.again, pressed && styles.pressed]}
          >
            <Text style={styles.againText}>Celebrate again</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

// --- Confetti ----------------------------------------------------------------

const CONFETTI_COLORS = [colors.accent, colors.text, colors.attention, colors.done, colors.accentTextLight];
const PIECES = 36;
const FALL_HEIGHT = 640;

function Confetti({ burst }: { burst: number }) {
  const { width } = useWindowDimensions();
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => ({
        value: new Animated.Value(0),
        left: ((i * 37 + 11) % 100) / 100,
        dx: ((i * 53) % 120) - 60,
        delay: ((i * 7) % 10) * 60,
        duration: 1900 + ((i * 13) % 10) * 80,
        width: i % 3 === 0 ? 6 : 9,
        height: i % 3 === 0 ? 14 : 9,
        round: i % 4 === 0,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    [],
  );

  useEffect(() => {
    pieces.forEach((p) => p.value.setValue(0));
    const anim = Animated.parallel(
      pieces.map((p) =>
        Animated.timing(p.value, {
          toValue: 1,
          duration: p.duration,
          delay: p.delay,
          easing: Easing.bezier(0.2, 0.6, 0.4, 1),
          useNativeDriver: true,
        }),
      ),
    );
    anim.start();
    return () => anim.stop();
  }, [burst, pieces]);

  return (
    <View style={styles.confetti} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            top: 0,
            left: p.left * width,
            width: p.width,
            height: p.height,
            borderRadius: p.round ? radius.pill : 2,
            backgroundColor: p.color,
            opacity: p.value.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [
              { translateX: p.value.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
              { translateY: p.value.interpolate({ inputRange: [0, 1], outputRange: [-40, FALL_HEIGHT - 20] }) },
              { rotate: p.value.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '540deg'] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  confetti: { position: 'absolute', top: 0, left: 0, right: 0, height: FALL_HEIGHT, overflow: 'hidden', zIndex: 1 },
  main: { flexGrow: 1, alignItems: 'center', gap: 18, paddingTop: 64, paddingBottom: 16, paddingHorizontal: 24 },
  badge: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.done,
  },
  headings: { gap: 6, alignItems: 'center' },
  title: { ...type.display, color: colors.text, textAlign: 'center' },
  subtitle: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.textSecondary, textAlign: 'center' },
  stats: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  stat: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  nudge: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  nudgeBody: { flex: 1, gap: 8 },
  nudgeText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  nudgeLink: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.accentText },
  footer: { gap: 4, paddingTop: 12, paddingBottom: 16, paddingHorizontal: 24 },
  again: { height: 44, alignItems: 'center', justifyContent: 'center' },
  againText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
  pressed: { opacity: 0.7 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: screenGutter },
  message: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
});
