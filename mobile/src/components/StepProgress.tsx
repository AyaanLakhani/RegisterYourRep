import { StyleSheet, View } from 'react-native';

import { colors, radius } from '../theme';

// Workout: done / skipped / current / todo. Onboarding: filled / empty.
export type StepState = 'done' | 'skipped' | 'current' | 'todo' | 'filled' | 'empty';

export type StepProgressProps = {
  steps: readonly StepState[];
  // Defaults to "N of M complete".
  accessibilityLabel?: string;
};

const FILL: Record<StepState, string> = {
  done: colors.done,
  skipped: colors.skipped,
  current: colors.accent,
  todo: colors.border,
  filled: colors.accent,
  empty: colors.border,
};

const COMPLETE: readonly StepState[] = ['done', 'skipped', 'filled'];

// Segmented 4px bar.
export function StepProgress({ steps, accessibilityLabel }: StepProgressProps) {
  const complete = steps.filter((s) => COMPLETE.includes(s)).length;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? `${complete} of ${steps.length} complete`}
      accessibilityValue={{ min: 0, max: steps.length, now: complete }}
    >
      {steps.map((s, i) => (
        <View key={i} style={[styles.segment, { backgroundColor: FILL[s] }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 4, borderRadius: radius.pill },
});
