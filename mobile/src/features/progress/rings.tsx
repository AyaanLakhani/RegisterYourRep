// SVG rings for the Progress tab (react-native-svg, no chart library).
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors, fonts } from '../../theme';

export type RingSpec = { radius: number; fraction: number; color: string; track: string };

/** Concentric progress rings, each starting at 12 o'clock. */
export function Rings({
  size,
  strokeWidth,
  rings,
  accessibilityLabel,
}: {
  size: number;
  strokeWidth: number;
  rings: RingSpec[];
  accessibilityLabel: string;
}) {
  const c = size / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      {rings.map((r) => {
        const circumference = 2 * Math.PI * r.radius;
        const f = Math.max(0, Math.min(1, r.fraction));
        return [
          <Circle key={`t${r.radius}`} cx={c} cy={c} r={r.radius} fill="none" stroke={r.track} strokeWidth={strokeWidth} />,
          f > 0 ? (
            <Circle
              key={`v${r.radius}`}
              cx={c}
              cy={c}
              r={r.radius}
              fill="none"
              stroke={r.color}
              strokeWidth={strokeWidth}
              strokeLinecap={f < 1 ? 'round' : 'butt'}
              strokeDasharray={`${circumference * f} ${circumference}`}
              transform={`rotate(-90 ${c} ${c})`}
            />
          ) : null,
        ];
      })}
    </Svg>
  );
}

/** The "87% completed" ring on the Consistency card. */
export function CompletionRing({ percent }: { percent: number }) {
  const size = 104;
  return (
    <View style={{ width: size, height: size }}>
      <Rings
        size={size}
        strokeWidth={10}
        rings={[{ radius: 44, fraction: percent / 100, color: colors.accent, track: colors.border }]}
        accessibilityLabel={`${percent}% of sessions completed`}
      />
      <View style={styles.center} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.percent}>{percent}%</Text>
        <Text style={styles.caption}>completed</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  percent: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.text },
  caption: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 14, color: colors.textSecondary },
});
