import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors, sizes } from '../theme';
import { Icon, type IconName } from './Icon';

export type IconButtonProps = {
  icon: IconName;
  // Required: the button has no visible text.
  accessibilityLabel: string;
  onPress?: () => void;
  // surface = header buttons (back, more); raised = in-card actions (move session).
  tone?: 'surface' | 'raised';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

// 44×44 icon-only button.
export function IconButton({ icon, accessibilityLabel, onPress, tone = 'surface', disabled = false, style }: IconButtonProps) {
  const color = disabled ? colors.skipped : tone === 'raised' ? colors.textMuted : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.base, styles[tone], pressed && styles.pressed, style]}
    >
      <Icon name={icon} size={tone === 'raised' ? 18 : 20} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: sizes.minTapTarget,
    height: sizes.minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  surface: { backgroundColor: colors.surface, borderRadius: 12 },
  raised: { backgroundColor: colors.raised, borderRadius: 10 },
  pressed: { opacity: 0.7 },
});
