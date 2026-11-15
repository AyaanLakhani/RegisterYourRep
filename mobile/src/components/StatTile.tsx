import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../theme';

export type StatTileProps = {
  value: string; // "6 wks", "87%"
  label: string; // "consistent"
  // tile = boxed 28pt (Progress); inline = unboxed, centred 22pt (Week "Week so far").
  variant?: 'tile' | 'inline';
};

export function StatTile({ value, label, variant = 'tile' }: StatTileProps) {
  const inline = variant === 'inline';
  return (
    <View style={inline ? styles.inline : styles.tile} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={[styles.value, inline && styles.valueInline]}>{value}</Text>
      <Text style={[styles.label, inline && styles.labelInline]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, gap: 2, padding: 14, borderRadius: 12, backgroundColor: colors.surface },
  inline: { flex: 1, alignItems: 'center' },
  value: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, color: colors.text },
  valueInline: { fontSize: 22, lineHeight: 28 },
  label: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  labelInline: { fontSize: 12, lineHeight: 16 },
});
