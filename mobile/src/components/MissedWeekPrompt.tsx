import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../theme';
import { Button } from './Button';
import { Icon } from './Icon';

export type MissedWeekPromptProps = {
  onContinue: () => void;
  onStartFresh: () => void;
  // Shows "Take a lighter week instead" when provided.
  onLighterWeek?: () => void;
  title?: string;
  message?: string;
};

export function MissedWeekPrompt({
  onContinue,
  onStartFresh,
  onLighterWeek,
  title = 'Last week got away from you',
  message = 'No problem. Pick up where you left off, or start this week fresh.',
}: MissedWeekPromptProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Icon name="restart" size={20} color={colors.attention} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      </View>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.buttons}>
        <Button label="Continue" size="compact" onPress={onContinue} style={styles.flex} />
        <Button label="Start fresh" size="compact" variant="secondary" onPress={onStartFresh} style={styles.flex} />
      </View>
      {onLighterWeek && <Button label="Take a lighter week instead" variant="text" size="sm" onPress={onLighterWeek} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.attentionSoft,
  },
  title: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.text },
  message: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  buttons: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
