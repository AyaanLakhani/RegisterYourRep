import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../theme';
import { IconButton } from './IconButton';

export type ScreenHeaderProps = {
  title: string;
  // Line under the title ("Nov 9 – 15 · PPL v2").
  subtitle?: string;
  // Line above the title ("Thursday, Nov 12").
  eyebrow?: string;
  // Trailing element, e.g. an IconButton or two.
  right?: ReactNode;
  // Shows a back button when set.
  onBack?: () => void;
  backLabel?: string;
};

export function ScreenHeader({ title, subtitle, eyebrow, right, onBack, backLabel = 'Back' }: ScreenHeaderProps) {
  return (
    <View style={styles.row}>
      {onBack && <IconButton icon="back" accessibilityLabel={backLabel} onPress={onBack} />}
      <View style={styles.text}>
        {eyebrow ? <Text style={styles.meta}>{eyebrow}</Text> : null}
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.meta}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  right: { flexDirection: 'row', gap: 6 },
});
