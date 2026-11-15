// Week tab "Activity" chart: minutes done (solid) vs planned (dashed) per day.
// Drawn with react-native-svg; no chart library.
import { Fragment, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { colors, fonts } from '../../theme';
import { DAY_LETTERS } from './dates';
import type { DayRow } from './model';

const HEIGHT = 140;
const BAR_WIDTH = 26;
const MAX_BAR = 94;
const MIN_BAR = 4;
const LETTER_Y = HEIGHT - 2; // baseline of the day letters
const BAR_BOTTOM = HEIGHT - 20;
const VALUE_GAP = 6;

type Props = { days: DayRow[] };

export function ActivityChart({ days }: Props) {
  const [width, setWidth] = useState(0);
  const values = days.map((d) => d.doneMinutes || d.plannedMinutes);
  const max = Math.max(1, ...values);
  const col = width / 7;

  const summary = days
    .map((d, i) => {
      const day = DAY_LETTERS[i];
      if (d.doneMinutes) return `${day} ${d.doneMinutes} minutes done`;
      if (d.plannedMinutes) return `${day} ${d.plannedMinutes} minutes planned`;
      return `${day} rest`;
    })
    .join(', ');

  return (
    <View style={styles.wrap}>
      <View
        style={{ height: HEIGHT }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Minutes per day: ${summary}`}
      >
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            {days.map((d, i) => {
              const cx = col * i + col / 2;
              const x = cx - BAR_WIDTH / 2;
              const value = values[i];
              const done = d.doneMinutes > 0;
              const planned = !done && d.plannedMinutes > 0;
              const h = value > 0 ? Math.max(MIN_BAR, (value / max) * MAX_BAR) : MIN_BAR;
              const y = BAR_BOTTOM - h;
              const today = d.isToday;

              let bar;
              if (done) {
                bar = <Rect x={x} y={y} width={BAR_WIDTH} height={h} rx={8} fill={colors.accent} />;
              } else if (planned) {
                bar = (
                  <Rect
                    x={x + 0.75}
                    y={y + 0.75}
                    width={BAR_WIDTH - 1.5}
                    height={h - 1.5}
                    rx={7.5}
                    fill={today ? colors.accentSoft : 'none'}
                    stroke={today ? colors.accent : colors.skipped}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                );
              } else {
                bar = <Rect x={x} y={BAR_BOTTOM - MIN_BAR} width={BAR_WIDTH} height={MIN_BAR} rx={2} fill={colors.border} />;
              }

              const valueColor = done
                ? colors.textSecondary
                : planned
                  ? today
                    ? colors.accentText
                    : colors.textTertiary
                  : colors.skipped;
              const letterColor = today ? colors.accent : d.session ? colors.textSecondary : colors.textTertiary;

              return (
                <Fragment key={d.date}>
                  <SvgText
                    x={cx}
                    y={(value > 0 ? y : BAR_BOTTOM - MIN_BAR) - VALUE_GAP}
                    fontSize={11}
                    fontFamily={fonts.regular}
                    fill={valueColor}
                    textAnchor="middle"
                  >
                    {value > 0 ? String(value) : '–'}
                  </SvgText>
                  {bar}
                  <SvgText
                    x={cx}
                    y={LETTER_Y}
                    fontSize={11}
                    fontFamily={today ? fonts.bold : fonts.regular}
                    fontWeight={today ? 'bold' : 'normal'}
                    fill={letterColor}
                    textAnchor="middle"
                  >
                    {DAY_LETTERS[i]}
                  </SvgText>
                </Fragment>
              );
            })}
          </Svg>
        )}
      </View>
      <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.swatchDone]} />
          <Text style={styles.legendText}>Done (min)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.swatchPlanned]} />
          <Text style={styles.legendText}>Planned</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  swatchDone: { backgroundColor: colors.accent },
  swatchPlanned: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.skipped },
  legendText: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
});
