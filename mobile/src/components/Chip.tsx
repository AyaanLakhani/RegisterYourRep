import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts, radius, sizes } from '../theme';
import { Icon } from './Icon';

export type ChipProps = {
  label: string;
  selected: boolean;
  onPress?: () => void;
  disabled?: boolean;
};

// Selectable pill (exercise picks in onboarding). Selected shows a check.
export function Chip({ label, selected, onPress, disabled = false }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [styles.base, selected ? styles.selected : styles.idle, pressed && styles.pressed]}
    >
      {selected && <Icon name="check" size={16} strokeWidth={2.5} color={colors.text} />}
      <Text style={[styles.label, selected ? styles.labelSelected : styles.labelIdle]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    minHeight: sizes.minTapTarget,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: radius.pill,
  },
  selected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  idle: { borderColor: colors.borderStrong, backgroundColor: 'transparent' },
  pressed: { opacity: 0.8 },
  label: { fontSize: 14 },
  labelSelected: { fontFamily: fonts.semibold, color: colors.text },
  labelIdle: { fontFamily: fonts.medium, color: colors.textMuted },
});
