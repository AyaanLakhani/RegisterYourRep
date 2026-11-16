import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts } from '../theme';

export type CardVariant = 'sunken' | 'raised' | 'highlight';

export type CardProps = {
  children: ReactNode;
  // sunken = section panels (#141414); raised = prompts (#1A1A1A); highlight = "do this next" (accent border).
  variant?: CardVariant;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Card({ children, variant = 'sunken', gap = 12, style, accessibilityLabel }: CardProps) {
  return (
    <View style={[styles.base, styles[variant], { gap }, style]} accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
}

export type SectionTitleProps = {
  children: string;
  // Optional trailing text/element, e.g. "120 min so far".
  right?: ReactNode;
};

// Small uppercase grey heading used inside cards ("WEEK SO FAR").
export function SectionTitle({ children, right }: SectionTitleProps) {
  return (
    <View style={styles.titleRow}>
      <Text style={styles.title} accessibilityRole="header">
        {children}
      </Text>
      {typeof right === 'string' ? <Text style={styles.right}>{right}</Text> : right}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1 },
  sunken: { padding: 16, borderRadius: 16, backgroundColor: colors.surfaceSunken, borderColor: colors.border },
  raised: { padding: 18, borderRadius: 14, backgroundColor: colors.surface, borderColor: colors.border },
  highlight: { padding: 18, borderRadius: 18, backgroundColor: colors.surface, borderColor: colors.accent },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 1.04,
    textTransform: 'uppercase',
    color: colors.textTertiary,
  },
  right: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
});
