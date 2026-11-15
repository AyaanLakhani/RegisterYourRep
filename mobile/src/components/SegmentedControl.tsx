import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../theme';

export type SegmentOption<T extends string> = { value: T; label: string };

export type SegmentedControlProps<T extends string> = {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  // Names the group for screen readers, e.g. "Plan version".
  accessibilityLabel: string;
};

// Two-or-more way toggle (Proposal: Recommended / As you asked).
export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel }: SegmentedControlProps<T>) {
  return (
    <View style={styles.track} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: selected, selected }}
            // Segment is 40 tall inside a 48 track; extend the touch area to 48.
            hitSlop={{ top: 4, bottom: 4 }}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.label, selected ? styles.labelSelected : styles.labelIdle]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  segment: {
    flex: 1,
    height: 40,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: { backgroundColor: colors.raisedHigh },
  label: { fontSize: 14 },
  labelSelected: { fontFamily: fonts.semibold, color: colors.text },
  labelIdle: { fontFamily: fonts.medium, color: colors.textSecondary },
});
