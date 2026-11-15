import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '../theme';
import { Icon } from './Icon';

export type CoachAvatarProps = { size?: number };

// Amber dumbbell in a brown circle. Decorative: hidden from screen readers.
export function CoachAvatar({ size = 32 }: CoachAvatarProps) {
  return (
    <View
      style={[styles.avatar, { width: size, height: size }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Icon name="coach" size={Math.round(size * 0.56)} color={colors.coach} />
    </View>
  );
}

export type ChatBubbleProps = {
  from: 'user' | 'coach';
  text: string;
  // User bubbles: accent fill (Coach chat) or muted grey (onboarding answer echo).
  tone?: 'accent' | 'muted';
  // Coach bubbles show the avatar by default.
  showAvatar?: boolean;
};

export function ChatBubble({ from, text, tone = 'accent', showAvatar = true }: ChatBubbleProps) {
  if (from === 'user') {
    return (
      <View
        style={[styles.bubble, styles.user, tone === 'muted' && styles.userMuted]}
        accessible
        accessibilityLabel={`You: ${text}`}
      >
        <Text style={[styles.text, tone === 'muted' ? styles.textMuted : styles.textUser]}>{text}</Text>
      </View>
    );
  }
  return (
    <View style={styles.coachRow} accessible accessibilityLabel={`Coach: ${text}`}>
      {showAvatar && <CoachAvatar />}
      <View style={[styles.bubble, styles.coach]}>
        <Text style={[styles.text, styles.textMuted]}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    flexShrink: 0,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.coachSoft,
  },
  bubble: { paddingVertical: 10, paddingHorizontal: 14 },
  user: {
    alignSelf: 'flex-end',
    maxWidth: 270,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 16,
    backgroundColor: colors.accentFill,
  },
  userMuted: { backgroundColor: colors.raised },
  coachRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  coach: {
    flexShrink: 1,
    maxWidth: 280,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 4,
    backgroundColor: colors.surface,
  },
  text: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  textUser: { color: colors.text },
  textMuted: { color: colors.textMuted },
});
