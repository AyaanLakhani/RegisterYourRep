// Home tab (RYR-23): what to do right now. Week calendar, missed-week prompt,
// today's session (or rest day), the next session and the monthly goal card.
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, useQuery, usingMocks, type DayDate, type Session, type Week } from '../../api';
import { mockDataSource } from '../../api/mock';
import { Badge, Button, Card, Icon, IconButton, MissedWeekPrompt } from '../../components';
import { MonthGoalCard } from '../../features/home/MonthGoalCard';
import {
  addDays,
  dayOfMonth,
  greeting,
  localToday,
  longDate,
  monthLabel,
  shortDate,
  shortWeekday,
} from '../../lib/dates';
import { formatMusclesAnd } from '../../lib/format';
import { colors, fonts, radius, screenGutter, type } from '../../theme';

// Weeks (by Monday) whose missed-week prompt the user already answered this app run.
const answeredMissedWeeks = new Set<string>();

const PENDING_STATUSES: readonly Session['status'][] = ['scheduled', 'moved', 'carried_over'];
const isPending = (s: Session) => PENDING_STATUSES.includes(s.status);

const REST_TIP = 'Rest is part of the plan: muscles rebuild on days off. A walk or some light stretching is plenty.';

export default function HomeScreen() {
  const today = useQuery(() => api.getToday(), []);
  const profile = useQuery(() => api.getProfile(), []);

  const todayDate = today.data?.date;
  const currentWeek = today.data?.week;

  // Week calendar: 0 = the active week, -1 = last week, ...
  const [weekOffset, setWeekOffset] = useState(0);
  const otherStart = currentWeek && weekOffset !== 0 ? addDays(currentWeek.startDate, weekOffset * 7) : undefined;
  const other = useQuery(() => (otherStart ? api.getWeek(otherStart) : Promise.resolve(undefined)), [otherStart]);
  const shownWeek: Week | undefined =
    weekOffset === 0 ? currentWeek : other.data && other.data.startDate === otherStart ? other.data : undefined;

  // Up next: the next pending session after today, looking into next week if this one is done.
  const nextInWeek = currentWeek?.sessions
    .filter((s) => todayDate && s.date > todayDate && isPending(s))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const nextWeekStart = currentWeek && todayDate && !nextInWeek ? addDays(currentWeek.startDate, 7) : undefined;
  const nextWeek = useQuery(
    () => (nextWeekStart ? api.getWeek(nextWeekStart) : Promise.resolve(undefined)),
    [nextWeekStart],
  );
  const upNext =
    nextInWeek ??
    (nextWeekStart && nextWeek.data?.startDate === nextWeekStart
      ? [...nextWeek.data.sessions].sort((a, b) => a.date.localeCompare(b.date)).find(isPending)
      : undefined);

  const [selected, setSelected] = useState<DayDate>();
  const [, setAnswered] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Refresh when coming back to Home (e.g. after a workout), but not on first mount.
  const focusedOnce = useRef(false);
  const refetchToday = today.refetch;
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) refetchToday();
      focusedOnce.current = true;
    }, [refetchToday]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([today.refetch(), profile.refetch(), otherStart ? other.refetch() : null]);
    setRefreshing(false);
  };

  const missed = today.data?.lastWeekMissedSessions ?? 0;
  const showMissed = !!currentWeek && missed > 0 && !answeredMissedWeeks.has(currentWeek.startDate);
  const answerMissed = () => {
    if (currentWeek) answeredMissedWeeks.add(currentWeek.startDate);
    setAnswered((n) => n + 1);
  };

  const toggleMissedDev = () => {
    mockDataSource.setMissedLastWeek(mockDataSource.getMissedLastWeek() > 0 ? 0 : 3);
    answeredMissedWeeks.clear();
    today.refetch();
  };

  const session = today.data?.session ?? null;

  let body;
  if (!today.data) {
    body = today.error ? (
      <View style={styles.center}>
        <Text style={styles.muted}>We couldn't load today.</Text>
        <Button label="Try again" variant="secondary" size="compact" onPress={today.refetch} />
      </View>
    ) : (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  } else {
    const t = today.data;
    body = (
      <>
        <WeekCalendar
          week={shownWeek}
          weekLoading={weekOffset !== 0 && !shownWeek}
          weekError={weekOffset !== 0 && !!other.error}
          todayDate={t.date}
          selected={selected}
          onSelect={setSelected}
          onPrev={() => setWeekOffset((o) => o - 1)}
          onNext={() => setWeekOffset((o) => o + 1)}
        />

        {showMissed ? (
          <MissedWeekPrompt
            message={`${missed} ${missed === 1 ? "session didn't" : "sessions didn't"} happen. Pick up where you left off, or start this week fresh?`}
            onContinue={answerMissed}
            onStartFresh={answerMissed}
          />
        ) : null}

        {session ? (
          <TodayCard session={session} onNotToday={() => setPickerOpen(true)} />
        ) : (
          <RestDayCard next={upNext} />
        )}

        {session && upNext ? <UpNextRow session={upNext} /> : null}

        <MonthGoalCard goal={t.monthGoal} />

        {session ? (
          <MoveSheet
            visible={pickerOpen}
            session={session}
            week={t.week}
            todayDate={t.date}
            onClose={() => setPickerOpen(false)}
            onMoved={() => {
              setPickerOpen(false);
              today.refetch();
            }}
          />
        ) : null}
      </>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.date}>{longDate(todayDate ?? localToday())}</Text>
            <Text style={styles.greeting} accessibilityRole="header">
              {greeting()}
            </Text>
          </View>
          <Pressable
            onPress={() => Alert.alert('Profile and settings', 'Coming soon.')}
            accessibilityRole="button"
            accessibilityLabel="Profile and settings"
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
          >
            <Text style={styles.avatarText}>{initials(profile.data?.displayName)}</Text>
          </Pressable>
        </View>

        <View style={styles.main}>
          {body}

          {__DEV__ ? (
            <View style={styles.devLinks}>
              <Link href="/onboarding" style={styles.devLink}>
                Start onboarding (dev)
              </Link>
              <Link href="/dev/components" style={styles.devLink}>
                Component gallery (dev)
              </Link>
              {usingMocks ? (
                <Text style={styles.devLink} onPress={toggleMissedDev} accessibilityRole="button">
                  {missed > 0 ? 'Hide' : 'Show'} missed-week prompt (dev)
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function initials(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Me';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

// --- Week calendar -----------------------------------------------------------

type DayState = 'done' | 'today' | 'upcoming' | 'missed' | 'rest';

function describeDay(date: DayDate, week: Week, todayDate: DayDate): { state: DayState; note: string } {
  const dow = shortWeekday(date);
  const s = week.sessions.find((x) => x.date === date);
  if (!s) return { state: 'rest', note: `${dow} · Rest day${date === todayDate ? ', today' : ''}` };
  const moved = s.status === 'moved' && s.movedFrom ? `, moved from ${shortWeekday(s.movedFrom)}` : '';
  const head = `${dow} · ${s.name} —`;
  if (s.status === 'done') {
    const done = s.logs.filter((l) => l.status === 'done').length;
    return { state: 'done', note: `${head} done, ${done} of ${s.exercises.length} exercises` };
  }
  if (s.status === 'skipped') return { state: 'missed', note: `${head} skipped` };
  if (date === todayDate) return { state: 'today', note: `${head} today, about ${s.estimatedMinutes} min${moved}` };
  if (date < todayDate) return { state: 'missed', note: `${head} missed` };
  return { state: 'upcoming', note: `${head} ${s.estimatedMinutes} min${moved}` };
}

type WeekCalendarProps = {
  week: Week | undefined;
  weekLoading: boolean;
  weekError: boolean;
  todayDate: DayDate;
  selected: DayDate | undefined;
  onSelect: (date: DayDate) => void;
  onPrev: () => void;
  onNext: () => void;
};

function WeekCalendar({ week, weekLoading, weekError, todayDate, selected, onSelect, onPrev, onNext }: WeekCalendarProps) {
  const dates = week ? Array.from({ length: 7 }, (_, i) => addDays(week.startDate, i)) : [];
  const fallback = dates.includes(todayDate) ? todayDate : dates[0];
  const sel = selected && dates.includes(selected) ? selected : fallback;
  const days = week ? dates.map((date) => ({ date, ...describeDay(date, week, todayDate) })) : [];
  const selectedNote = days.find((d) => d.date === sel)?.note;

  return (
    <View style={styles.calendar} accessibilityLabel="Calendar">
      <View style={styles.calHeader}>
        <Text style={styles.month}>{week ? monthLabel(week.startDate, week.endDate) : ' '}</Text>
        <View style={styles.calNav}>
          <IconButton icon="back" tone="raised" accessibilityLabel="Previous week" onPress={onPrev} style={styles.navBtn} />
          <IconButton icon="forward" tone="raised" accessibilityLabel="Next week" onPress={onNext} style={styles.navBtn} />
        </View>
      </View>

      {week ? (
        <View style={styles.pills}>
          {days.map((d) => (
            <DayPill
              key={d.date}
              date={d.date}
              state={d.state}
              label={d.note}
              selected={d.date === sel}
              onPress={() => onSelect(d.date)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.pillsPlaceholder}>
          {weekError ? (
            <Text style={styles.note}>Couldn't load this week.</Text>
          ) : weekLoading ? (
            <ActivityIndicator color={colors.accent} />
          ) : null}
        </View>
      )}
      <Text style={styles.note} accessibilityLiveRegion="polite">
        {selectedNote ?? ' '}
      </Text>
    </View>
  );
}

type DayPillProps = { date: DayDate; state: DayState; label: string; selected: boolean; onPress: () => void };

function DayPill({ date, state, label, selected, onPress }: DayPillProps) {
  const isToday = state === 'today';
  const textColor = selected || isToday ? colors.text : state === 'rest' ? colors.textTertiary : colors.textMuted;
  let dot;
  if (state === 'rest') dot = null;
  else if (selected) dot = { backgroundColor: colors.text };
  else if (state === 'done') dot = { backgroundColor: colors.done };
  else if (state === 'today') dot = { backgroundColor: colors.accent };
  else if (state === 'missed') dot = { backgroundColor: colors.skipped };
  else dot = { borderWidth: 1.5, borderColor: colors.skipped };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[styles.pill, selected ? styles.pillSelected : isToday ? styles.pillToday : styles.pillIdle]}
    >
      <Text style={[styles.pillDow, { color: textColor }]}>{shortWeekday(date)}</Text>
      <Text style={[styles.pillDate, { color: textColor }]}>{dayOfMonth(date)}</Text>
      <View style={[styles.dot, dot]} />
    </Pressable>
  );
}

// --- Today ---------------------------------------------------------------------

function TodayCard({ session, onNotToday }: { session: Session; onNotToday: () => void }) {
  const muscles = formatMusclesAnd(session.focus);
  const count = session.exercises.length;
  const meta = `${muscles ? `${muscles} · ` : ''}${count} ${count === 1 ? 'exercise' : 'exercises'}`;

  if (session.status === 'done' || session.status === 'skipped') {
    const done = session.logs.filter((l) => l.status === 'done').length;
    return (
      <Card variant="raised" gap={14}>
        <View style={styles.rowBetween}>
          <Text style={styles.overline}>Today</Text>
          <Badge
            label={session.status === 'done' ? 'Done' : 'Skipped'}
            tone={session.status === 'done' ? 'done' : 'neutral'}
            icon={session.status === 'done' ? 'check' : undefined}
          />
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.sessionName}>{session.name}</Text>
          <Text style={styles.muted}>
            {session.status === 'done' ? `${done} of ${count} exercises done. Nice work.` : meta}
          </Text>
        </View>
      </Card>
    );
  }

  const shown = session.exercises.slice(0, 3);
  const more = count - shown.length;
  const started = session.logs.length > 0;

  return (
    <Card variant="highlight" gap={14}>
      <View style={styles.rowBetween}>
        <Text style={styles.overline}>Today</Text>
        <Text style={styles.minutes}>~{session.estimatedMinutes} min</Text>
      </View>
      <View style={styles.titleBlock}>
        <Text style={styles.sessionName} accessibilityRole="header">
          {session.name}
        </Text>
        <Text style={styles.muted}>{meta}</Text>
      </View>
      <View style={styles.tags}>
        {shown.map((e) => (
          <View key={e.exerciseId} style={styles.tag}>
            <Text style={styles.tagText}>{e.name}</Text>
          </View>
        ))}
        {more > 0 ? (
          <View style={styles.tag}>
            <Text style={[styles.tagText, styles.tagMore]}>+{more} more</Text>
          </View>
        ) : null}
      </View>
      <Button
        label={started ? 'Resume workout' : 'Start workout'}
        onPress={() => router.push({ pathname: '/workout', params: { sessionId: session.id } })}
      />
      {!started ? (
        <Button
          label="Not today"
          variant="text"
          size="sm"
          onPress={onNotToday}
          accessibilityHint="Move this session to another day this week"
        />
      ) : null}
    </Card>
  );
}

function RestDayCard({ next }: { next: Session | undefined }) {
  return (
    <Card variant="raised" gap={14}>
      <Text style={styles.overline}>Today</Text>
      <View style={styles.titleBlock}>
        <Text style={styles.sessionName} accessibilityRole="header">
          Rest day
        </Text>
        <Text style={styles.muted}>{REST_TIP}</Text>
      </View>
      {next ? <UpNextRow session={next} /> : null}
    </Card>
  );
}

function UpNextRow({ session }: { session: Session }) {
  const muscles = formatMusclesAnd(session.focus);
  return (
    <View
      style={styles.upNext}
      accessible
      accessibilityLabel={`Up next: ${shortDate(session.date)}, ${session.name}${muscles ? `, ${muscles}` : ''}, ${session.estimatedMinutes} minutes`}
    >
      <View style={styles.upNextDate}>
        <Text style={styles.upNextDow}>{shortWeekday(session.date)}</Text>
        <Text style={styles.upNextDay}>{dayOfMonth(session.date)}</Text>
      </View>
      <View style={styles.upNextText}>
        <Text style={styles.upNextLabel}>Up next</Text>
        <Text style={styles.upNextName} numberOfLines={1}>
          {session.name}
          {muscles ? ` · ${muscles}` : ''}
        </Text>
      </View>
      <Text style={styles.minutes}>{session.estimatedMinutes} min</Text>
    </View>
  );
}

// --- Not today: move to another day this week ------------------------------------

type MoveSheetProps = {
  visible: boolean;
  session: Session;
  week: Week;
  todayDate: DayDate;
  onClose: () => void;
  onMoved: () => void;
};

function MoveSheet({ visible, session, week, todayDate, onClose, onMoved }: MoveSheetProps) {
  const insets = useSafeAreaInsets();
  const [moving, setMoving] = useState<DayDate>();

  const taken = new Set(week.sessions.map((s) => s.date));
  const freeDays: DayDate[] = [];
  for (let d = addDays(todayDate, 1); d <= week.endDate; d = addDays(d, 1)) {
    if (!taken.has(d)) freeDays.push(d);
  }

  const move = async (date: DayDate) => {
    setMoving(date);
    try {
      await api.moveSession(session.id, date);
      onMoved();
    } catch (err) {
      Alert.alert("Couldn't move this session", err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setMoving(undefined);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <Text style={styles.sheetTitle} accessibilityRole="header">
          Move {session.name} to…
        </Text>
        {freeDays.length > 0 ? (
          <>
            <Text style={styles.muted}>Pick another day this week.</Text>
            {freeDays.map((d) => (
              <Pressable
                key={d}
                onPress={() => move(d)}
                disabled={!!moving}
                accessibilityRole="button"
                accessibilityLabel={`Move to ${shortDate(d)}`}
                style={({ pressed }) => [styles.dayOption, pressed && styles.pressed]}
              >
                <Text style={styles.dayOptionText}>{shortDate(d)}</Text>
                {moving === d ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <Icon name="forward" size={18} color={colors.textSecondary} />
                )}
              </Pressable>
            ))}
          </>
        ) : (
          <Text style={styles.muted}>No free days left this week. It's fine to skip it; next week starts fresh.</Text>
        )}
        <Button label="Cancel" variant="text" size="sm" onPress={onClose} disabled={!!moving} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  pressed: { opacity: 0.8 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 48 },
  muted: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textSecondary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 20,
    paddingHorizontal: screenGutter,
    paddingBottom: 8,
  },
  headerText: { flex: 1, gap: 2 },
  date: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  greeting: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.text },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },

  main: { gap: 16, paddingTop: 8, paddingHorizontal: screenGutter, paddingBottom: 16 },

  calendar: {
    gap: 10,
    paddingTop: 14,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  month: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  calNav: { flexDirection: 'row', gap: 4 },
  navBtn: { backgroundColor: colors.surfaceMuted },
  pills: { flexDirection: 'row', gap: 4 },
  pillsPlaceholder: { height: 68, alignItems: 'center', justifyContent: 'center' },
  pill: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    minHeight: 68,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  pillSelected: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },
  pillToday: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  pillIdle: { backgroundColor: 'transparent', borderColor: 'transparent' },
  pillDow: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 14, opacity: 0.85 },
  pillDate: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20 },
  dot: { width: 6, height: 6, borderRadius: radius.pill },
  note: { paddingHorizontal: 4, fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textSecondary },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overline: { ...type.overline, color: colors.accentText },
  minutes: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  titleBlock: { gap: 4 },
  sessionName: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.text },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.sm, backgroundColor: colors.raised },
  tagText: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textMuted },
  tagMore: { color: colors.textSecondary },

  upNext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  upNextDate: { width: 40, alignItems: 'center' },
  upNextDow: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  upNextDay: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 22, color: colors.text },
  upNextText: { flex: 1, gap: 2 },
  upNextLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary },
  upNextName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },

  backdrop: { flex: 1, backgroundColor: colors.background, opacity: 0.7 },
  sheet: {
    gap: 10,
    paddingTop: 20,
    paddingHorizontal: screenGutter,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sheetTitle: { ...type.heading, color: colors.text },
  dayOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.raised,
  },
  dayOptionText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },

  devLinks: { gap: 0, paddingTop: 8 },
  devLink: { ...type.label, color: colors.accentText, paddingVertical: 12 },
});
