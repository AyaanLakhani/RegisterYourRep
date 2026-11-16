import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '../theme';
import { Icon, type IconName } from './Icon';

export type BadgeTone = 'accent' | 'done' | 'attention' | 'neutral';

export type BadgeProps = {
  label: string;
  tone: BadgeTone;
  icon?: IconName;
};

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  accent: { bg: colors.accentSoft, fg: colors.accentText },
  done: { bg: colors.doneSoft, fg: colors.doneText },
  attention: { bg: colors.attentionSoft, fg: colors.attention },
  neutral: { bg: colors.raised, fg: colors.textSubtle },
};

// Small status pill (Today, Done, Moved from Wed, Skipped, Pending, Applied, Declined).
export function Badge({ label, tone, icon }: BadgeProps) {
  const t = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      {icon && <Icon name={icon} size={12} strokeWidth={3} color={t.fg} />}
      <Text style={[styles.label, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  label: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
});
