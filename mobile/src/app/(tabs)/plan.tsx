// Plan tab (RYR-28): the current program, moving training days, version history
// and the way into Ask Coach. Design: board "9 · Plan" (project/Plan.dc.html).
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import {
  api,
  useQuery,
  type DayMove,
  type Muscle,
  type Program,
  type ProgramDay,
  type ProgramVersionSummary,
  type Weekday,
} from '../../api';
import { Badge, Button, Icon, IconButton } from '../../components';
import { colors, fonts, radius, screenGutter, sizes } from '../../theme';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_SHORT: Record<Weekday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};
const DAY_LONG: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Nov 2" in the user's local time. */
function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'chest',
  back: 'back',
  shoulders: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  quads: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
  abs: 'abs',
  obliques: 'abs',
  lower_back: 'lower back',
};

/** Short muscle summary for a day row, e.g. "Chest, back, arms". */
function muscleSummary(focus: Muscle[]): string {
  let labels = [...new Set(focus.map((m) => MUSCLE_LABEL[m]))];
  if (labels.includes('biceps') && labels.includes('triceps')) {
    labels = labels.filter((l) => l !== 'biceps' && l !== 'triceps' && l !== 'forearms');
    labels.push('arms');
  }
  // Shoulders get worked by most upper days; only name them when little else is listed.
  if (labels.length > 2) labels = labels.filter((l) => l !== 'shoulders');
  const text = labels.slice(0, 3).join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function sortDays<T extends { weekday: Weekday }>(days: T[]): T[] {
  return [...days].sort((a, b) => WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday));
}

/**
 * Orders moves so each one lands on a free weekday when applied one after another
 * (the UI never lets two days share a weekday, so a valid order always exists).
 */
function orderMoves(moves: DayMove[], days: ProgramDay[]): DayMove[] {
  const occupied = new Set(days.map((d) => d.weekday));
  const pending = [...moves];
  const ordered: DayMove[] = [];
  while (pending.length) {
    const i = pending.findIndex((m) => !occupied.has(m.to));
    if (i === -1) return [...ordered, ...pending]; // cycle; let the server report it
    const [m] = pending.splice(i, 1);
    occupied.delete(m.from);
    occupied.add(m.to);
    ordered.push(m);
  }
  return ordered;
}

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

type ToastState = { kind: 'hidden' } | { kind: 'unsaved'; error?: string } | { kind: 'saving' } | { kind: 'saved'; text: string };

/** A day as shown in the list: where it is in the program and where the draft puts it. */
type DayRowModel = { day: ProgramDay; weekday: Weekday; moved: boolean };

export default function PlanScreen() {
  const program = useQuery(() => api.getProgram(), []);
  const week = useQuery(() => api.getCurrentWeek(), []);
  const reduceMotion = useReduceMotion();

  // Refetch when the tab regains focus so changes made in Ask Coach show up.
  const firstFocus = useRef(true);
  const refetchProgram = program.refetch;
  const refetchWeek = week.refetch;
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      refetchProgram();
      refetchWeek();
    }, [refetchProgram, refetchWeek]),
  );

  const current = program.data?.current;

  // Draft moves: original weekday -> new weekday. Local until "Save changes".
  const [draft, setDraft] = useState<Partial<Record<Weekday, Weekday>>>({});
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState<ToastState>({ kind: 'hidden' });
  const [picking, setPicking] = useState<ProgramDay | null>(null);
  const [viewing, setViewing] = useState<{ program: Program; day?: ProgramDay } | null>(null);
  const [loadingVersion, setLoadingVersion] = useState<number | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // A new program version (saved here or applied from Coach) invalidates the draft.
  const currentVersion = current?.version;
  useEffect(() => {
    setDraft({});
  }, [currentVersion]);

  const moves: DayMove[] = useMemo(
    () =>
      Object.entries(draft)
        .filter(([from, to]) => to && from !== to)
        .map(([from, to]) => ({ from: from as Weekday, to: to as Weekday })),
    [draft],
  );
  const hasChanges = moves.length > 0;

  // Show the "unsaved" toast whenever there is a draft (unless saving/saved is showing).
  useEffect(() => {
    setToast((t) => {
      if (t.kind === 'saving' || t.kind === 'saved') return t;
      if (hasChanges) return t.kind === 'unsaved' ? t : { kind: 'unsaved' };
      return { kind: 'hidden' };
    });
  }, [hasChanges]);

  const rows: DayRowModel[] = useMemo(() => {
    if (!current) return [];
    return sortDays(
      current.days.map((day) => {
        const to = draft[day.weekday];
        return { day, weekday: to ?? day.weekday, moved: !!to && to !== day.weekday };
      }),
    );
  }, [current, draft]);

  const resetDraft = () => {
    setDraft({});
    setToast({ kind: 'hidden' });
  };

  const save = async () => {
    if (!current || !hasChanges) return;
    setToast({ kind: 'saving' });
    const ordered = orderMoves(moves, current.days);
    const savedText =
      ordered.length === 1
        ? `${current.days.find((d) => d.weekday === ordered[0].from)?.name ?? 'Day'} moved to ${DAY_SHORT[ordered[0].to]}`
        : `${ordered.length} days moved`;
    try {
      await api.saveDayMoves({ moves: ordered });
      setEditing(false);
      setToast({ kind: 'saved', text: `Changes saved · ${savedText}` });
      await Promise.all([program.refetch(), week.refetch()]);
      timers.current.push(setTimeout(() => setToast((t) => (t.kind === 'saved' ? { kind: 'hidden' } : t)), 1700));
    } catch (err) {
      setToast({ kind: 'unsaved', error: err instanceof Error ? err.message : "Couldn't save. Try again." });
    }
  };

  const moveDay = (day: ProgramDay, to: Weekday) => {
    setDraft((d) => {
      const next = { ...d };
      if (to === day.weekday) delete next[day.weekday];
      else next[day.weekday] = to;
      return next;
    });
    // Editing again while "Changes saved" is still showing goes straight back to unsaved.
    setToast((t) => (t.kind === 'saved' && to !== day.weekday ? { kind: 'unsaved' } : t));
    setPicking(null);
  };

  /** Opens this week's session for the day, or a read-only view of the program day. */
  const openDay = (day: ProgramDay) => {
    const sessions = week.data?.sessions ?? [];
    const session =
      sessions.find((s) => s.weekday === day.weekday && s.name === day.name) ?? sessions.find((s) => s.name === day.name);
    if (session) {
      router.push({ pathname: '/workout', params: { sessionId: session.id } });
    } else if (current) {
      setViewing({ program: current, day });
    }
  };

  const viewVersion = async (v: ProgramVersionSummary) => {
    setLoadingVersion(v.version);
    setVersionError(null);
    try {
      const p = await api.getProgramVersion(v.version);
      setViewing({ program: p });
    } catch (err) {
      setVersionError(err instanceof Error ? err.message : "Couldn't load that version.");
    } finally {
      setLoadingVersion(null);
    }
  };

  if (!program.data) {
    return (
      <SafeAreaView style={[styles.root, styles.center]} edges={['top']}>
        {program.error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Couldn't load your plan. {program.error.message}</Text>
            <Button label="Try again" variant="secondary" onPress={program.refetch} />
          </View>
        ) : (
          <ActivityIndicator color={colors.accent} accessibilityLabel="Loading your plan" />
        )}
      </SafeAreaView>
    );
  }

  const { current: cur, versions } = program.data;
  const otherVersions = versions.filter((v) => v.version !== cur.version);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, toast.kind !== 'hidden' && styles.contentWithToast]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>
              Your plan · v{cur.version} since {shortDate(cur.createdAt)}
            </Text>
            <Text style={styles.title} accessibilityRole="header">
              {cur.name}
            </Text>
          </View>
          <Pressable
            onPress={() => setEditing((e) => !e)}
            accessibilityRole="button"
            accessibilityState={{ expanded: editing }}
            accessibilityHint={editing ? undefined : 'Move training days to other weekdays'}
            style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
          >
            <Text style={styles.editButtonText}>{editing ? 'Done' : 'Edit days'}</Text>
          </Pressable>
        </View>

        {editing ? <Text style={styles.editHint}>Tap a day to move it. Moves apply from next week.</Text> : null}

        <View style={styles.panel}>
          {rows.map((row, i) => (
            <Pressable
              key={row.day.weekday}
              onPress={() => (editing ? setPicking(row.day) : openDay(row.day))}
              accessibilityRole="button"
              accessibilityLabel={`${DAY_LONG[row.weekday]}: ${row.day.name}, ${muscleSummary(row.day.focus)}, ${row.day.exercises.length} exercises${row.moved ? ', moved, not saved yet' : ''}`}
              accessibilityHint={editing ? 'Choose another day' : 'Opens this session'}
              style={({ pressed }) => [styles.dayRow, i < rows.length - 1 && styles.rowDivider, pressed && styles.pressedRow]}
            >
              <Text style={styles.dayName}>{DAY_SHORT[row.weekday]}</Text>
              <View style={styles.dayText}>
                <Text style={styles.sessionName}>{row.day.name}</Text>
                <Text style={styles.dayMeta}>
                  {muscleSummary(row.day.focus)} · {row.day.exercises.length}
                </Text>
              </View>
              {row.moved ? <Badge label="Moved · unsaved" tone="attention" /> : null}
              <Icon name={editing ? 'move' : 'forward'} size={18} color={colors.textTertiary} />
            </Pressable>
          ))}
        </View>

        <View style={[styles.panel, styles.versions]}>
          <Text style={styles.versionsTitle} accessibilityRole="header">
            Versions
          </Text>
          <View style={styles.versionRow}>
            <View style={styles.versionText}>
              <Text style={styles.versionName}>
                v{cur.version} · {cur.name}
              </Text>
              <Text style={styles.versionMeta}>
                {shortDate(cur.createdAt)}
                {cur.note ? ` · ${cur.note}` : ''}
              </Text>
            </View>
            <Badge label="Current" tone="done" />
          </View>
          {otherVersions.map((v) => (
            <View key={v.version} style={styles.versionRow}>
              <View style={styles.versionText}>
                <Text style={[styles.versionName, styles.versionNameOld]}>
                  v{v.version} · {v.name}
                </Text>
                <Text style={[styles.versionMeta, styles.versionMetaOld]}>
                  {shortDate(v.createdAt)}
                  {v.note ? ` · ${v.note}` : ''}
                </Text>
              </View>
              <Pressable
                onPress={() => viewVersion(v)}
                disabled={loadingVersion !== null}
                accessibilityRole="button"
                accessibilityLabel={`View version ${v.version}`}
                style={({ pressed }) => [styles.viewButton, pressed && styles.pressed]}
              >
                {loadingVersion === v.version ? (
                  <ActivityIndicator size="small" color={colors.textMuted} />
                ) : (
                  <Text style={styles.viewButtonText}>View</Text>
                )}
              </Pressable>
            </View>
          ))}
          {versionError ? <Text style={styles.errorText}>{versionError}</Text> : null}
        </View>

        <Pressable
          onPress={() => router.push('/coach')}
          accessibilityRole="link"
          accessibilityLabel="Ask your coach to change something"
          style={({ pressed }) => [styles.coachEntry, pressed && styles.pressed]}
        >
          <View style={styles.coachIcon}>
            <Svg width={18} height={18} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Path
                d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"
                stroke={colors.accent}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </View>
          <Text style={styles.coachEntryText}>Ask your coach to change something…</Text>
        </Pressable>
      </ScrollView>

      <SaveToast state={toast} reduceMotion={reduceMotion} onReset={resetDraft} onSave={save} />

      <WeekdayPicker
        day={picking}
        rows={rows}
        reduceMotion={reduceMotion}
        onPick={moveDay}
        onClose={() => setPicking(null)}
      />

      <ProgramViewer viewing={viewing} reduceMotion={reduceMotion} onClose={() => setViewing(null)} />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Unsaved-changes toast: unsaved -> saving -> saved -> hidden
// ---------------------------------------------------------------------------

function SaveToast({
  state,
  reduceMotion,
  onReset,
  onSave,
}: {
  state: ToastState;
  reduceMotion: boolean;
  onReset: () => void;
  onSave: () => void;
}) {
  const visible = state.kind !== 'hidden';
  const anim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  // Keep the last visible state while the toast animates out.
  const lastShown = useRef<ToastState>(state);
  if (visible) lastShown.current = state;

  useEffect(() => {
    if (visible) setMounted(true);
    const anims = Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: reduceMotion ? 0 : visible ? 350 : 200,
      useNativeDriver: true,
    });
    anims.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => anims.stop();
  }, [visible, reduceMotion, anim]);

  if (!mounted) return null;
  const s = lastShown.current;

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        {
          opacity: anim,
          transform: reduceMotion
            ? []
            : [
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
                { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
              ],
        },
      ]}
    >
      {s.kind === 'unsaved' ? (
        <>
          <Text style={[styles.toastText, s.error ? styles.toastError : null]} numberOfLines={2}>
            {s.error ?? 'You have unsaved changes'}
          </Text>
          <Pressable
            onPress={onReset}
            accessibilityRole="button"
            accessibilityHint="Throws away the unsaved day moves"
            style={({ pressed }) => [styles.toastButton, pressed && styles.pressed]}
          >
            <Text style={styles.toastButtonText}>Reset</Text>
          </Pressable>
          <Pressable
            onPress={onSave}
            accessibilityRole="button"
            style={({ pressed }) => [styles.toastButton, styles.toastSave, pressed && styles.pressed]}
          >
            <Text style={[styles.toastButtonText, styles.toastSaveText]}>Save changes</Text>
          </Pressable>
        </>
      ) : s.kind === 'saving' ? (
        <>
          <ActivityIndicator size="small" color={colors.textMuted} />
          <Text style={[styles.toastText, styles.toastStatus]}>Saving…</Text>
        </>
      ) : s.kind === 'saved' ? (
        <>
          <View style={styles.toastCheck}>
            <Icon name="check" size={14} strokeWidth={3} color={colors.background} />
          </View>
          <Text style={[styles.toastText, styles.toastStatus]} numberOfLines={2}>
            {s.text}
          </Text>
        </>
      ) : null}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Weekday picker (Edit days)
// ---------------------------------------------------------------------------

function WeekdayPicker({
  day,
  rows,
  reduceMotion,
  onPick,
  onClose,
}: {
  day: ProgramDay | null;
  rows: DayRowModel[];
  reduceMotion: boolean;
  onPick: (day: ProgramDay, to: Weekday) => void;
  onClose: () => void;
}) {
  const row = rows.find((r) => r.day === day);
  return (
    <Modal
      visible={!!day}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      <SafeAreaView style={styles.sheetWrap} edges={['bottom']} pointerEvents="box-none">
        <View style={styles.sheet} accessibilityViewIsModal>
          {day && row ? (
            <>
              <Text style={styles.sheetTitle} accessibilityRole="header">
                Move {day.name} to…
              </Text>
              <View style={styles.weekdayGrid}>
                {WEEKDAYS.map((wd) => {
                  const takenBy = rows.find((r) => r.weekday === wd && r.day !== day);
                  const selected = row.weekday === wd;
                  return (
                    <Pressable
                      key={wd}
                      onPress={() => onPick(day, wd)}
                      disabled={!!takenBy}
                      accessibilityRole="button"
                      accessibilityLabel={`${DAY_LONG[wd]}${takenBy ? `, taken by ${takenBy.day.name}` : ''}${wd === day.weekday ? ', original day' : ''}`}
                      accessibilityState={{ selected, disabled: !!takenBy }}
                      style={({ pressed }) => [
                        styles.weekdayOption,
                        selected && styles.weekdaySelected,
                        !!takenBy && styles.weekdayTaken,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.weekdayLabel, !!takenBy && styles.weekdayLabelTaken]}>{DAY_SHORT[wd]}</Text>
                      <Text style={[styles.weekdaySub, selected && styles.weekdaySubSelected]} numberOfLines={1}>
                        {takenBy ? takenBy.day.name : selected ? day.name : 'Rest'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Button label="Cancel" variant="secondary" size="compact" onPress={onClose} />
            </>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Read-only program view: an older version, or one day with no session this week
// ---------------------------------------------------------------------------

function ProgramViewer({
  viewing,
  reduceMotion,
  onClose,
}: {
  viewing: { program: Program; day?: ProgramDay } | null;
  reduceMotion: boolean;
  onClose: () => void;
}) {
  const p = viewing?.program;
  const days = p ? (viewing?.day ? [viewing.day] : sortDays(p.days)) : [];
  return (
    <Modal
      visible={!!viewing}
      animationType={reduceMotion ? 'none' : 'slide'}
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {p ? (
          <>
            <View style={styles.viewerHeader}>
              <IconButton icon="close" accessibilityLabel="Close" onPress={onClose} />
              <View style={styles.headerText}>
                <Text style={styles.eyebrow}>
                  {viewing?.day
                    ? `${DAY_LONG[viewing.day.weekday]} · v${p.version}`
                    : `v${p.version} · ${shortDate(p.createdAt)}${p.status === 'current' ? ' · Current' : ' · Read only'}`}
                </Text>
                <Text style={styles.viewerTitle} accessibilityRole="header" numberOfLines={2}>
                  {viewing?.day ? viewing.day.name : p.name}
                </Text>
              </View>
            </View>
            <ScrollView contentContainerStyle={styles.viewerContent}>
              {!viewing?.day && p.note ? <Text style={styles.viewerNote}>{p.note}</Text> : null}
              {days.map((d) => (
                <View key={d.weekday} style={[styles.panel, styles.viewerDay]}>
                  <View style={styles.viewerDayHeader}>
                    <Text style={styles.sessionName}>
                      {viewing?.day ? muscleSummary(d.focus) : `${DAY_SHORT[d.weekday]} · ${d.name}`}
                    </Text>
                    <Text style={styles.dayMeta}>~{d.estimatedMinutes} min</Text>
                  </View>
                  {d.exercises.map((e, i) => (
                    <View key={`${e.exerciseId}-${i}`} style={styles.exerciseRow}>
                      <Text style={styles.exerciseName}>{e.name}</Text>
                      <Text style={styles.exerciseMeta}>
                        {e.sets} × {e.reps} · {e.restSeconds}s rest
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          </>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: screenGutter },
  content: { paddingHorizontal: screenGutter, paddingTop: 20, paddingBottom: 16, gap: 14 },
  contentWithToast: { paddingBottom: 96 },
  pressed: { opacity: 0.75 },
  pressedRow: { backgroundColor: colors.surface },

  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, paddingBottom: 2 },
  headerText: { flex: 1, gap: 2 },
  eyebrow: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.text },
  editButton: {
    minHeight: sizes.minTapTarget,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  editButtonText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  editHint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },

  panel: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSunken },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, paddingVertical: 8 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  dayName: { width: 36, fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  dayText: { flex: 1 },
  sessionName: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.text },
  dayMeta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textSecondary },

  versions: { padding: 14, gap: 8 },
  versionsTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  versionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 36 },
  versionText: { flex: 1 },
  versionName: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.text },
  versionNameOld: { fontFamily: fonts.regular, color: colors.textMuted },
  versionMeta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  versionMetaOld: { color: colors.textTertiary },
  viewButton: {
    minHeight: sizes.minTapTarget,
    minWidth: 60,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
  },
  viewButtonText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted },

  coachEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  coachIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  coachEntryText: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary },

  errorBox: { gap: 12, alignItems: 'stretch', alignSelf: 'stretch' },
  errorText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' },

  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 56,
    paddingVertical: 8,
    paddingRight: 8,
    paddingLeft: 18,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
    elevation: 12,
    shadowColor: colors.background,
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
  },
  toastText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  toastStatus: { minHeight: 40, textAlignVertical: 'center', paddingVertical: 10 },
  toastError: { color: colors.attention },
  toastButton: {
    minHeight: sizes.minTapTarget,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastSave: { paddingHorizontal: 16, backgroundColor: colors.accentFill },
  toastButtonText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textMuted },
  toastSaveText: { color: colors.text },
  toastCheck: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.done,
  },

  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.background, opacity: 0.7 },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    margin: 12,
    padding: 18,
    gap: 16,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sheetTitle: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, color: colors.text },
  weekdayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  weekdayOption: {
    width: '22.5%',
    flexGrow: 1,
    minHeight: 56,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.raised,
  },
  weekdaySelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  weekdayTaken: { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  weekdayLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  weekdayLabelTaken: { color: colors.skipped },
  weekdaySub: { fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary },
  weekdaySubSelected: { color: colors.accentTextLight },

  viewerHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: screenGutter, paddingVertical: 12 },
  viewerTitle: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.text },
  viewerContent: { paddingHorizontal: screenGutter, paddingBottom: 24, gap: 12 },
  viewerNote: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  viewerDay: { padding: 14, gap: 10 },
  viewerDayHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  exerciseRow: { gap: 2 },
  exerciseName: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  exerciseMeta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textTertiary },
});
