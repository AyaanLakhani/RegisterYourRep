// Loading shimmer for text and placeholder blocks (RYR-21).
//
// Built on React Native's Animated with the native driver, no extra
// dependencies. Text shimmer slides a brighter copy of the text through a few
// clipping bands, which reads as a soft highlight without a masked gradient.
// Respects the system Reduce Motion setting: when it is on, nothing animates.
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '../theme';

/** True while the OS "Reduce Motion" / "Remove animations" setting is on. */
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduce(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/** 0 → 1 on a linear loop while `enabled`. */
function useLoop(duration: number, enabled: boolean) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled) return;
    progress.setValue(0);
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [duration, enabled, progress]);
  return progress;
}

// Nested bands, widest and faintest first, so the highlight fades at its edges.
const TEXT_BANDS = [
  { size: 0.5, opacity: 0.35 },
  { size: 0.3, opacity: 0.6 },
  { size: 0.14, opacity: 1 },
];

export type ShimmerTextProps = {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  /** Resting text colour while shimmering. */
  baseColor: string;
  /** Colour of the moving highlight, and of the text when motion is off. */
  highlightColor: string;
  duration?: number;
  /** Turn the shimmer off without unmounting. */
  active?: boolean;
  numberOfLines?: number;
  accessibilityRole?: 'header' | 'text';
};

export function ShimmerText({
  children,
  style,
  baseColor,
  highlightColor,
  duration = 2200,
  active = true,
  numberOfLines,
  accessibilityRole,
}: ShimmerTextProps) {
  const reduceMotion = useReduceMotion();
  const enabled = active && !reduceMotion;
  const [width, setWidth] = useState(0);
  const progress = useLoop(duration, enabled && width > 0);

  // The band centre travels from half a width before the text to half a width after it.
  const bands = useMemo(
    () =>
      TEXT_BANDS.map(({ size, opacity }) => {
        const band = width * size;
        const from = -0.5 * width - band / 2;
        const to = 1.5 * width - band / 2;
        return {
          band,
          opacity,
          outer: progress.interpolate({ inputRange: [0, 1], outputRange: [from, to] }),
          inner: progress.interpolate({ inputRange: [0, 1], outputRange: [-from, -to] }),
        };
      }),
    [progress, width],
  );

  if (!enabled) {
    return (
      <Text style={[style, { color: highlightColor }]} numberOfLines={numberOfLines} accessibilityRole={accessibilityRole}>
        {children}
      </Text>
    );
  }

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View onLayout={onLayout}>
      <Text style={[style, { color: baseColor }]} numberOfLines={numberOfLines} accessibilityRole={accessibilityRole}>
        {children}
      </Text>
      {width > 0 &&
        bands.map(({ band, opacity, outer, inner }, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.band, { width: band, opacity, transform: [{ translateX: outer }] }]}
          >
            <Animated.Text
              numberOfLines={numberOfLines}
              style={[style, { color: highlightColor, width, transform: [{ translateX: inner }] }]}
            >
              {children}
            </Animated.Text>
          </Animated.View>
        ))}
    </View>
  );
}

export type ShimmerBlockProps = {
  height: number;
  borderRadius?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
};

/** Placeholder card with a soft highlight sweeping across it. */
export function ShimmerBlock({ height, borderRadius = 14, duration = 1800, style }: ShimmerBlockProps) {
  const reduceMotion = useReduceMotion();
  const [width, setWidth] = useState(0);
  const enabled = !reduceMotion && width > 0;
  const progress = useLoop(duration, enabled);
  const gradientId = `shimmer${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const band = width * 0.5;
  const translateX = useMemo(
    () => progress.interpolate({ inputRange: [0, 1], outputRange: [-band, width] }),
    [progress, band, width],
  );

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.block, { height, borderRadius }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {enabled && (
        <Animated.View pointerEvents="none" style={[styles.sweep, { width: band, transform: [{ translateX }] }]}>
          <Svg width={band} height={height}>
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.raised} stopOpacity={0} />
                <Stop offset="0.5" stopColor={colors.raised} stopOpacity={1} />
                <Stop offset="1" stopColor={colors.raised} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={band} height={height} fill={`url(#${gradientId})`} />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden' },
  block: { overflow: 'hidden', backgroundColor: colors.surfaceSunken },
  sweep: { position: 'absolute', top: 0, bottom: 0, left: 0 },
});
