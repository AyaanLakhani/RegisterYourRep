import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, radius } from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'text';
// md = 52 (main screen actions), compact = 48 (actions inside cards), sm = 44 (dense rows).
export type ButtonSize = 'md' | 'compact' | 'sm';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  // Navigates with expo-router after onPress runs.
  href?: Href;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

const SIZES: Record<ButtonSize, { height: number; fontSize: number; radius: number }> = {
  md: { height: 52, fontSize: 16, radius: radius.md },
  compact: { height: 48, fontSize: 15, radius: radius.md },
  sm: { height: 44, fontSize: 14, radius: 10 },
};

// Primary is the one "do this next" action on a screen; secondary and text are everything else.
export function Button({
  label,
  onPress,
  href,
  variant = 'primary',
  size = 'md',
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ButtonProps) {
  const s = SIZES[size];

  const handlePress = () => {
    onPress?.();
    if (href) router.push(href);
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        { height: s.height, borderRadius: s.radius },
        disabled ? styles.disabled : styles[variant],
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          { fontSize: s.fontSize },
          { color: disabled ? colors.skipped : variant === 'text' ? colors.accent : colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primary: { backgroundColor: colors.accentFill },
  secondary: { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.borderStrong },
  text: { backgroundColor: 'transparent' },
  disabled: { backgroundColor: colors.surfaceMuted },
  pressed: { opacity: 0.8 },
  label: { fontFamily: fonts.semibold },
});
