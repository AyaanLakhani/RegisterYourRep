// Home's monthly goal card (design update, Nov 15): a ring for sessions done
// against the month's plan, a pace badge, and "Days by type" bars. The type
// furthest behind its goal is shown in the attention colour.
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { MonthGoal } from '../../api';
import { Badge } from '../../components';
import { colors, fonts, radius } from '../../theme';

const RING_SIZE = 84;
const RING_STROKE = 9;
const RING_RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const ratio = (done: number, goal: number) => (goal > 0 ? Math.min(done / goal, 1) : 0);

function monthName(firstDay: string) {
  const [y, m] = firstDay.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long' });
}

function pace(goal: MonthGoal): { label: string; tone: 'attention' | 'done' } {
  const diff = goal.sessionsDone - goal.sessionsExpectedByToday;
  if (diff < 0) return { label: `${-diff} behind pace`, tone: 'attention' };
  if (diff > 0) return { label: `${diff} ahead of pace`, tone: 'done' };
  return { label: 'On pace', tone: 'done' };
}

// The single type with the lowest share of its goal, if one stands out.
function laggingType(goal: MonthGoal): string | undefined {
  const rows = goal.byType.filter((t) => t.goal > 0);
  if (rows.length < 2) return undefined;
  const sorted = [...rows].sort((a, b) => ratio(a.done, a.goal) - ratio(b.done, b.goal));
  return ratio(sorted[0].done, sorted[0].goal) < ratio(sorted[1].done, sorted[1].goal) ? sorted[0].type : undefined;
}

export function MonthGoalCard({ goal }: { goal: MonthGoal }) {
  const percent = Math.round(ratio(goal.sessionsDone, goal.sessionsGoal) * 100);
  const filled = (percent / 100) * CIRCUMFERENCE;
  const { label: paceLabel, tone: paceTone } = pace(goal);
  const lagging = laggingType(goal);
  const month = monthName(goal.month);

  return (
    <View style={styles.card} accessibilityLabel={`${month} goal`}>
      <Text style={styles.title} accessibilityRole="header">
        {month} goal
      </Text>

      <View style={styles.summary}>
        <View
          style={styles.ring}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`${percent}% of the monthly goal done: ${goal.sessionsDone} of ${goal.sessionsGoal} sessions`}
        >
          <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke={colors.border}
              strokeWidth={RING_STROKE}
            />
            {filled > 0 && (
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                stroke={colors.accent}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            )}
          </Svg>
          <View style={styles.ringLabel}>
            <Text style={styles.ringPercent}>{percent}%</Text>
          </View>
        </View>
        <View style={styles.summaryText}>
          <Text style={styles.sessions}>
            {goal.sessionsDone} of {goal.sessionsGoal} <Text style={styles.sessionsUnit}>sessions</Text>
          </Text>
          <Badge label={paceLabel} tone={paceTone} />
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.typesHeader}>
        <Text style={styles.typesTitle} accessibilityRole="header">
          Days by type
        </Text>
        <Text style={styles.typesNote}>done / goal</Text>
      </View>
      {goal.byType.map((t) => {
        const isLagging = t.type === lagging;
        const barColor = isLagging ? colors.attention : colors.accent;
        return (
          <View
            key={t.type}
            style={styles.typeRow}
            accessible
            accessibilityLabel={`${t.type}: ${t.done} of ${t.goal} days${isLagging ? ', furthest behind' : ''}`}
          >
            <Text style={[styles.typeLabel, isLagging && styles.typeLabelLagging]}>{t.type}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${ratio(t.done, t.goal) * 100}%`, backgroundColor: barColor }]} />
            </View>
            <Text style={styles.typeCount}>
              {t.done}/{t.goal}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
    padding: 16,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  title: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.text },

  summary: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ring: { width: RING_SIZE, height: RING_SIZE },
  ringLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPercent: { fontFamily: fonts.display, fontSize: 20, color: colors.text },
  summaryText: { gap: 4, alignItems: 'flex-start' },
  sessions: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.text },
  sessionsUnit: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },

  divider: { height: 1, backgroundColor: colors.border },

  typesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  typesTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted },
  typesNote: { fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeLabel: { width: 44, fontFamily: fonts.regular, fontSize: 13, color: colors.text },
  typeLabelLagging: { fontFamily: fonts.semibold, color: colors.attention },
  track: { flex: 1, height: 10, borderRadius: radius.pill, backgroundColor: colors.raised, overflow: 'hidden' },
  fill: { height: 10, borderRadius: radius.pill },
  typeCount: { width: 36, textAlign: 'right', fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
});
