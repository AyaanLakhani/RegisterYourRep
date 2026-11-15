import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
} from 'react-native';

import { colors, fonts } from '../theme';
import { Button } from './Button';
import { Icon } from './Icon';

export type ExerciseState = 'todo' | 'active' | 'done' | 'skipped';

export type ExerciseRowProps = {
  name: string;
  dose: string; // "3 × 12"
  state: ExerciseState;
  // skipped: shown as "Skipped · <reason>".
  skipReason?: string;
  // active: the dose line under the name, e.g. "3 sets × 12 reps · rest 60s". Falls back to dose.
  detail?: string;
  // active: form cue paragraph.
  cue?: string;
  // active: reps logged per set; null = not logged yet.
  sets?: readonly (number | null)[];
  onSetPress?: (index: number) => void;
  onDone?: () => void;
  onSkip?: () => void;
  onSwap?: () => void;
  // done / skipped rows (e.g. to reopen); todo rows use tap to toggle Swap/Skip instead.
  onPress?: () => void;
  // todo rows: control the revealed Swap/Skip actions (so only one row is open at a time).
  actionsOpen?: boolean;
  onActionsOpenChange?: (open: boolean) => void;
};

export function ExerciseRow(props: ExerciseRowProps) {
  if (props.state === 'active') return <ActiveExercise {...props} />;
  if (props.state === 'todo' && (props.onSkip || props.onSwap)) return <SwipeableTodo {...props} />;
  return <StaticRow {...props} />;
}

function StatusCircle({ state }: { state: ExerciseState }) {
  if (state === 'done') {
    return (
      <View style={[styles.circle, styles.circleDone]}>
        <Icon name="check" size={16} strokeWidth={3} color={colors.background} />
      </View>
    );
  }
  return (
    <View
      style={[
        styles.circle,
        state === 'skipped' ? styles.circleSkipped : state === 'active' ? styles.circleActive : styles.circleTodo,
      ]}
    />
  );
}

function RowContent({ name, dose, state, skipReason }: ExerciseRowProps) {
  const muted = state === 'done' || state === 'skipped';
  return (
    <>
      <StatusCircle state={state} />
      <View style={styles.rowText}>
        <Text style={[styles.rowName, muted && styles.rowNameMuted]} numberOfLines={1}>
          {name}
        </Text>
        {state === 'skipped' && (
          <Text style={styles.rowReason} numberOfLines={1}>
            {skipReason ? `Skipped · ${skipReason}` : 'Skipped'}
          </Text>
        )}
      </View>
      <Text style={[styles.rowDose, muted && styles.rowDoseMuted]}>{dose}</Text>
    </>
  );
}

function rowLabel({ name, dose, state, skipReason }: ExerciseRowProps) {
  const status = state === 'done' ? 'done' : state === 'skipped' ? `skipped${skipReason ? `, ${skipReason}` : ''}` : 'to do';
  return `${name}, ${dose}, ${status}`;
}

function StaticRow(props: ExerciseRowProps) {
  if (props.onPress) {
    return (
      <Pressable
        onPress={props.onPress}
        accessibilityRole="button"
        accessibilityLabel={rowLabel(props)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <RowContent {...props} />
      </Pressable>
    );
  }
  return (
    <View style={styles.row} accessible accessibilityLabel={rowLabel(props)}>
      <RowContent {...props} />
    </View>
  );
}

const ACTION_WIDTH = 76;

// Todo row: swipe left (or tap) to reveal Swap and Skip.
function SwipeableTodo(props: ExerciseRowProps) {
  const { onSkip, onSwap, actionsOpen, onActionsOpenChange } = props;
  const [localOpen, setLocalOpen] = useState(false);
  const open = actionsOpen ?? localOpen;
  const setOpen = (next: boolean) => {
    if (actionsOpen === undefined) setLocalOpen(next);
    onActionsOpenChange?.(next);
  };

  const actionCount = (onSwap ? 1 : 0) + (onSkip ? 1 : 0);
  const reveal = actionCount * ACTION_WIDTH;

  const x = useRef(new Animated.Value(0)).current;
  const openRef = useRef(open);
  openRef.current = open;
  const setOpenRef = useRef(setOpen);
  setOpenRef.current = setOpen;
  const revealRef = useRef(reveal);
  revealRef.current = reveal;

  useEffect(() => {
    Animated.spring(x, { toValue: open ? -reveal : 0, useNativeDriver: true, speed: 20, bounciness: 0 }).start();
  }, [open, reveal, x]);

  const pan = useRef(
    PanResponder.create({
      // Capture so a horizontal drag takes over from the row's Pressable.
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const reveal = revealRef.current;
        const base = openRef.current ? -reveal : 0;
        x.setValue(Math.max(-reveal, Math.min(0, base + g.dx)));
      },
      onPanResponderRelease: (_, g) => {
        const reveal = revealRef.current;
        const base = openRef.current ? -reveal : 0;
        const end = base + g.dx;
        const next = g.vx < -0.3 ? true : g.vx > 0.3 ? false : end < -reveal / 2;
        if (next === openRef.current) {
          Animated.spring(x, { toValue: next ? -reveal : 0, useNativeDriver: true, speed: 20, bounciness: 0 }).start();
        } else {
          setOpenRef.current(next);
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(x, { toValue: openRef.current ? -revealRef.current : 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const run = (fn?: () => void) => () => {
    setOpen(false);
    fn?.();
  };

  const onAccessibilityAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'skip') run(onSkip)();
    if (e.nativeEvent.actionName === 'swap') run(onSwap)();
  };

  return (
    <View style={styles.swipeWrap}>
      <View
        style={styles.actions}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      >
        {onSwap && (
          <Pressable
            onPress={run(onSwap)}
            accessibilityRole="button"
            accessibilityLabel={`Swap ${props.name}`}
            style={[styles.action, { backgroundColor: colors.raisedHigh }]}
          >
            <Icon name="swap" size={18} color={colors.text} />
            <Text style={[styles.actionLabel, { color: colors.text }]}>Swap</Text>
          </Pressable>
        )}
        {onSkip && (
          <Pressable
            onPress={run(onSkip)}
            accessibilityRole="button"
            accessibilityLabel={`Skip ${props.name}`}
            style={[styles.action, { backgroundColor: colors.attentionStrong }]}
          >
            <Icon name="skip" size={18} color={colors.attention} />
            <Text style={[styles.actionLabel, { color: colors.attention }]}>Skip</Text>
          </Pressable>
        )}
      </View>
      <Animated.View style={{ transform: [{ translateX: x }] }} {...pan.panHandlers}>
        <Pressable
          onPress={() => setOpen(!open)}
          accessibilityRole="button"
          accessibilityLabel={`${props.name}, ${props.dose}`}
          accessibilityHint={open ? 'Hides skip and swap' : 'Shows skip and swap'}
          accessibilityState={{ expanded: open }}
          accessibilityActions={[
            ...(onSkip ? [{ name: 'skip', label: 'Skip' }] : []),
            ...(onSwap ? [{ name: 'swap', label: 'Swap' }] : []),
          ]}
          onAccessibilityAction={onAccessibilityAction}
          style={styles.row}
        >
          <RowContent {...props} />
          <Icon name="back" size={16} color={colors.skipped} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

function ActiveExercise({ name, dose, detail, cue, sets, onSetPress, onDone, onSkip, onSwap }: ExerciseRowProps) {
  return (
    <View style={styles.active}>
      <View style={styles.activeHeader}>
        <StatusCircle state="active" />
        <View style={styles.rowText}>
          <Text style={styles.activeName} accessibilityRole="header">
            {name}
          </Text>
          <Text style={styles.activeDetail}>{detail ?? dose}</Text>
        </View>
      </View>
      {cue ? <Text style={styles.cue}>{cue}</Text> : null}
      {sets && sets.length > 0 && (
        <View style={styles.sets}>
          {sets.map((reps, i) => {
            const logged = reps !== null;
            const content = (
              <>
                <Text style={[styles.setLabel, logged && styles.setLabelLogged]}>Set {i + 1}</Text>
                <Text style={[styles.setValue, !logged && styles.setValueEmpty]}>{logged ? reps : '—'}</Text>
              </>
            );
            const label = `Set ${i + 1}, ${logged ? `${reps} reps` : 'not logged'}`;
            return onSetPress ? (
              <Pressable
                key={i}
                onPress={() => onSetPress(i)}
                accessibilityRole="button"
                accessibilityLabel={label}
                style={[styles.set, logged && styles.setLogged]}
              >
                {content}
              </Pressable>
            ) : (
              <View key={i} style={[styles.set, logged && styles.setLogged]} accessible accessibilityLabel={label}>
                {content}
              </View>
            );
          })}
        </View>
      )}
      <View style={styles.activeButtons}>
        <Button label="Done" size="compact" onPress={onDone} style={styles.doneButton} accessibilityLabel={`Mark ${name} done`} />
        <Button label="Skip" size="compact" variant="secondary" onPress={onSkip} style={styles.flex} accessibilityLabel={`Skip ${name}`} />
        <Button label="Swap" size="compact" variant="secondary" onPress={onSwap} style={styles.flex} accessibilityLabel={`Swap ${name}`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.8 },
  circle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  circleDone: { backgroundColor: colors.done },
  circleTodo: { borderWidth: 2, borderColor: colors.borderStrong },
  circleActive: { borderWidth: 2, borderColor: colors.accent },
  circleSkipped: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.skipped },
  rowText: { flex: 1 },
  rowName: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20, color: colors.text },
  rowNameMuted: { color: colors.textSecondary },
  rowReason: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textTertiary },
  rowDose: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  rowDoseMuted: { color: colors.textTertiary },

  swipeWrap: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface },
  actions: { position: 'absolute', top: 0, right: 0, bottom: 0, flexDirection: 'row' },
  action: { width: ACTION_WIDTH, alignItems: 'center', justifyContent: 'center', gap: 3 },
  actionLabel: { fontFamily: fonts.semibold, fontSize: 12 },

  active: {
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  activeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  activeName: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, color: colors.text },
  activeDetail: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  cue: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textSubtle },
  sets: { flexDirection: 'row', gap: 8 },
  set: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.raised,
  },
  setLogged: { backgroundColor: colors.accentSoft },
  setLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary },
  setLabelLogged: { color: colors.accentTextLight },
  setValue: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  setValueEmpty: { color: colors.textSecondary },
  activeButtons: { flexDirection: 'row', gap: 8 },
  doneButton: { flex: 2 },
  flex: { flex: 1 },
});
