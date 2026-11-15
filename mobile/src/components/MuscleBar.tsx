import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '../theme';

export type MuscleBarProps = {
  label: string; // "Chest"
  value: number; // sessions trained
  max: number; // target (bar is full at max)
  // attention = under-trained (amber). Never red.
  tone?: 'accent' | 'attention';
};

export function MuscleBar({ label, value, max, tone = 'accent' }: MuscleBarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${label}: ${value} of ${max}`}
      accessibilityValue={{ min: 0, max, now: Math.min(value, max) }}
    >
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${pct * 100}%`, backgroundColor: tone === 'attention' ? colors.attention : colors.accent },
          ]}
        />
      </View>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { width: 64, fontFamily: fonts.regular, fontSize: 13, color: colors.text },
  track: { flex: 1, height: 10, borderRadius: radius.pill, backgroundColor: colors.raised, overflow: 'hidden' },
  fill: { height: 10, borderRadius: radius.pill },
  value: { width: 24, textAlign: 'right', fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
});
