// Progress tab (RYR-27): consistency, muscle balance, most skipped and the
// level-up card. Every number comes from ProgressStats; no AI.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { api, useQuery, type MuscleGroup, type ProgressStats } from '../../api';
import { Button, Card, ScreenHeader } from '../../components';
import {
  coachLine,
  GROUP_LABEL,
  GROUP_MUSCLES,
  leastTrained,
  SKIP_REASON_LABEL,
} from '../../features/progress/model';
import { CompletionRing, Rings } from '../../features/progress/rings';
import { colors, fonts, radius, screenGutter } from '../../theme';

// Ring colours per group, outermost first (matches the design).
const GROUP_RING: Record<MuscleGroup, { color: string; track: string; radius: number }> = {
  upper: { color: colors.accent, track: colors.accentSoft, radius: 56 },
  lower: { color: colors.attention, track: colors.attentionSoft, radius: 42 },
  core: { color: colors.textMuted, track: colors.raised, radius: 28 },
};

export default function ProgressScreen() {
  const { data, error, loading, refetch } = useQuery(() => api.getProgress(), []);
  const [refreshing, setRefreshing] = useState(false);

  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      refetch();
    }, [refetch]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
        }
      >
        <ScreenHeader title="Progress" right={<Text style={styles.range}>Last 4 weeks</Text>} />
        {!data && loading ? (
          <ActivityIndicator color={colors.accent} style={styles.loader} />
        ) : !data ? (
          <Card variant="raised">
            <Text style={styles.body}>Couldn't load your progress. {error?.message}</Text>
            <Button label="Try again" variant="secondary" size="compact" onPress={refetch} />
          </Card>
        ) : (
          <ProgressBody stats={data} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ProgressBody({ stats }: { stats: ProgressStats }) {
  const least = leastTrained(stats.muscleBalance);
  const balanceLabel = stats.muscleBalance
    .map((b) => `${GROUP_LABEL[b.group]} ${b.actual} of ${b.target} sessions`)
    .join(', ');

  return (
    <>
      {/* Consistency */}
      <Card style={styles.consistency}>
        <CompletionRing percent={Math.round(stats.completionPercent)} />
        <View style={styles.consistencyText}>
          <View>
            <Text style={styles.bigNumber}>
              {stats.sessionsDone} of {stats.sessionsPlanned}
            </Text>
            <Text style={styles.caption}>sessions done</Text>
          </View>
          <View style={styles.divider} />
          <View>
            <Text style={styles.bigNumber}>
              {stats.streakWeeks} {stats.streakWeeks === 1 ? 'week' : 'weeks'}
            </Text>
            <Text style={styles.caption}>in a row on plan</Text>
          </View>
        </View>
      </Card>

      {/* Muscle balance */}
      <Card gap={14}>
        <View style={styles.titleRow}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            Muscle balance
          </Text>
          <Text style={styles.titleNote}>sessions vs. target</Text>
        </View>
        <View style={styles.balance}>
          <Rings
            size={128}
            strokeWidth={11}
            accessibilityLabel={balanceLabel}
            rings={stats.muscleBalance.map((b) => ({
              ...GROUP_RING[b.group],
              fraction: b.target > 0 ? b.actual / b.target : 0,
            }))}
          />
          <View style={styles.balanceLegend}>
            {stats.muscleBalance.map((b) => {
              const isLeast = least.has(b.group);
              return (
                <View key={b.group}>
                  <View style={styles.legendLabel}>
                    <View style={[styles.dot, { backgroundColor: GROUP_RING[b.group].color }]} />
                    <Text style={styles.caption}>{GROUP_LABEL[b.group]}</Text>
                  </View>
                  <Text style={styles.legendValue}>
                    {b.actual}/{b.target}{' '}
                    <Text style={[styles.legendNote, isLeast && styles.legendNoteLeast]}>
                      {isLeast ? 'least trained' : GROUP_MUSCLES[b.group]}
                    </Text>
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
        <Text style={styles.coach}>{coachLine(stats.muscleBalance)}</Text>
        <Button
          label="See every muscle"
          variant="secondary"
          size="sm"
          href="/muscles"
          style={styles.outlineButton}
        />
      </Card>

      {/* Most skipped */}
      <Card gap={6} style={styles.tight}>
        <Text style={[styles.cardTitle, styles.skippedTitle]} accessibilityRole="header">
          Most skipped
        </Text>
        {stats.mostSkipped.length === 0 ? (
          <Text style={styles.caption}>Nothing skipped. Nice work.</Text>
        ) : (
          stats.mostSkipped.map((m) => (
            <View
              key={m.exerciseId}
              style={styles.skipRow}
              accessible
              accessibilityLabel={`${m.name}, skipped ${m.count} times, usually because ${SKIP_REASON_LABEL[m.usualReason]}`}
            >
              <View style={styles.skipText}>
                <Text style={styles.skipName}>{m.name}</Text>
                <Text style={styles.skipReason}>usually "{SKIP_REASON_LABEL[m.usualReason]}"</Text>
              </View>
              <Text style={styles.skipCount}>{m.count}×</Text>
            </View>
          ))
        )}
      </Card>

      {/* Level up: only when the server says the rule is met */}
      {stats.levelUpReady && (
        <Card variant="highlight" gap={10} style={styles.levelUp}>
          <View style={styles.levelUpHead}>
            <View style={styles.levelUpIcon}>
              <Svg width={18} height={18} viewBox="0 0 24 24">
                <Path
                  d="M12 19V5M5 12l7-7 7 7"
                  stroke={colors.accent}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </Svg>
            </View>
            <Text style={styles.cardTitle}>Ready for the next level?</Text>
          </View>
          <Button label="See the new plan" size="sm" onPress={() => router.push('/plan')} />
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: screenGutter, paddingTop: 16, paddingBottom: 24, gap: 12 },
  loader: { marginTop: 40 },
  range: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  tight: { padding: 14, borderRadius: radius.lg },

  consistency: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  consistencyText: { flex: 1, gap: 10 },
  bigNumber: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, color: colors.text },
  divider: { height: 1, backgroundColor: colors.border },

  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.text },
  titleNote: { fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary },
  balance: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  balanceLegend: { flex: 1, gap: 12 },
  legendLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  legendValue: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, color: colors.text },
  legendNote: { fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary },
  legendNoteLeast: { color: colors.attention },
  coach: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  outlineButton: { height: 40, backgroundColor: 'transparent' },

  skippedTitle: { marginBottom: 2 },
  skipRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 },
  skipText: { flex: 1 },
  skipName: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text },
  skipReason: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textTertiary },
  skipCount: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },

  levelUp: { padding: 14, borderRadius: radius.lg },
  levelUpHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  levelUpIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
});
