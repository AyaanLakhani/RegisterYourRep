// Week tab (RYR-26): the week at a glance. Day rows, "Week so far" and the
// activity chart all derive from one Week response (see features/week/model).
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, useQuery, type DayDate, type Session, type Week } from '../../api';
import { Button, Card, IconButton, ScreenHeader, SectionTitle, SessionCard, StatTile } from '../../components';
import type { SessionStatus } from '../../components';
import { ActivityChart } from '../../features/week/ActivityChart';
import { addDays, dayName, dayOfMonth, formatRange } from '../../features/week/dates';
import { buildWeekView, exerciseCounts, moveTargets, type DayRow } from '../../features/week/model';
import { MoveSheet, SessionLogSheet } from '../../features/week/sheets';
import { colors, fonts, screenGutter } from '../../theme';

type Loaded = { week: Week; programLabel: string | null };

export default function WeekScreen() {
  // null = the current week.
  const [weekStart, setWeekStart] = useState<DayDate | null>(null);
  // "Today" comes from the data source (the mock has a fixed today).
  const [today, setToday] = useState<DayDate>();
  const [refreshing, setRefreshing] = useState(false);
  const [moving, setMoving] = useState<Session | null>(null);
  const [moveBusy, setMoveBusy] = useState(false);
  const [moveError, setMoveError] = useState<string>();
  const [logSession, setLogSession] = useState<Session | null>(null);

  const { data, error, loading, refetch } = useQuery<Loaded>(async () => {
    let week: Week;
    if (weekStart === null) {
      const t = await api.getToday();
      setToday(t.date);
      week = t.week;
    } else {
      week = await api.getWeek(weekStart);
    }
    const program = await api.getProgramVersion(week.programVersion).catch(() => null);
    return { week, programLabel: program ? `${program.name} v${program.version}` : null };
  }, [weekStart]);

  // Refetch when the tab regains focus (e.g. after moving a session on Home).
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      refetch();
    }, [refetch]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const week = data?.week;
  const view = useMemo(() => (week ? buildWeekView(week, today) : null), [week, today]);
  const canMove = !!week?.isActive;

  const openMove = (s: Session) => {
    setMoveError(undefined);
    setMoving(s);
  };

  const doMove = async (toDate: DayDate) => {
    if (!moving) return;
    setMoveBusy(true);
    setMoveError(undefined);
    try {
      await api.moveSession(moving.id, toDate);
      setMoving(null);
      await refetch();
    } catch (e) {
      setMoveError(e instanceof Error ? e.message : 'Could not move the session');
    } finally {
      setMoveBusy(false);
    }
  };

  const goWeek = (delta: number) => {
    if (!week) return;
    const next = addDays(week.startDate, delta * 7);
    // Coming back to the active week uses the current-week call.
    setWeekStart(delta > 0 && today && next <= today && addDays(next, 6) >= today ? null : next);
  };

  const subtitle = week
    ? [formatRange(week.startDate, week.endDate), data?.programLabel].filter(Boolean).join(' · ')
    : undefined;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
        }
      >
        <ScreenHeader
          title={week && !week.isActive ? 'Past week' : 'This week'}
          subtitle={subtitle}
          right={
            <>
              <IconButton
                icon="back"
                accessibilityLabel="Previous week"
                onPress={() => goWeek(-1)}
                disabled={!week || loading}
              />
              <IconButton
                icon="forward"
                accessibilityLabel="Next week"
                onPress={() => goWeek(1)}
                disabled={!week || loading || week.isActive}
              />
            </>
          }
        />

        {!view && loading ? (
          <ActivityIndicator color={colors.accent} style={styles.loader} />
        ) : !view ? (
          <Card variant="raised">
            <Text style={styles.message}>Couldn't load this week. {error?.message}</Text>
            <Button label="Try again" variant="secondary" size="compact" onPress={refetch} />
          </Card>
        ) : (
          <>
            {!week!.isActive && <Text style={styles.readOnly}>Past weeks are read-only.</Text>}
            <View style={styles.days}>
              {view.days.map((d) => (
                <DayCard
                  key={d.date}
                  row={d}
                  canMove={canMove}
                  onMove={openMove}
                  onOpen={(s) =>
                    d.kind === 'done'
                      ? setLogSession(s)
                      : router.push({ pathname: '/workout', params: { sessionId: s.id } })
                  }
                />
              ))}
            </View>

            <Card gap={10} style={styles.cardTight}>
              <SectionTitle>Week so far</SectionTitle>
              <View style={styles.stats}>
                <StatTile variant="inline" value={String(view.sessionsDone)} label="sessions done" />
                <StatTile variant="inline" value={`${view.exercisesDone}/${view.exercisesPlanned}`} label="exercises" />
                <StatTile variant="inline" value={String(view.sessionsToGo)} label="to go" />
              </View>
              <Text style={styles.note}>Anything unfinished on Sunday can roll into next week.</Text>
            </Card>

            <Card style={styles.cardTight} accessibilityLabel="Activity this week">
              <SectionTitle right={`${view.minutesDone} min so far`}>Activity</SectionTitle>
              <ActivityChart days={view.days} />
            </Card>
          </>
        )}
      </ScrollView>

      <MoveSheet
        session={moving}
        targets={moving && view ? moveTargets(view, moving, today) : []}
        busy={moveBusy}
        error={moveError}
        onPick={doMove}
        onClose={() => setMoving(null)}
      />
      <SessionLogSheet session={logSession} onClose={() => setLogSession(null)} />
    </SafeAreaView>
  );
}

type DayCardProps = {
  row: DayRow;
  canMove: boolean;
  onMove: (s: Session) => void;
  onOpen: (s: Session) => void;
};

function DayCard({ row, canMove, onMove, onOpen }: DayCardProps) {
  const { session, kind, date } = row;
  const day = dayName(date);
  const num = dayOfMonth(date);

  if (!session) return <SessionCard day={day} date={num} status="rest" />;

  const counts = exerciseCounts(session);
  const plannedLine = `${session.exercises.length} exercises · ${session.estimatedMinutes} min`;

  let status: SessionStatus = 'upcoming';
  let statusLabel: string | undefined;
  let subtitle = plannedLine;
  switch (kind) {
    case 'done':
      status = 'done';
      subtitle = `${counts.done} of ${counts.total}${counts.skipped ? ` · ${counts.skipped} skipped` : ' exercises'}`;
      break;
    case 'skipped':
      status = 'skipped';
      break;
    case 'today':
      status = 'today';
      break;
    case 'missed':
      statusLabel = 'Not done';
      break;
  }
  // Moved / carried-over sessions still to do show where they came from.
  if (kind !== 'done' && kind !== 'skipped' && session.movedFrom) {
    if (session.status === 'carried_over') {
      statusLabel = 'From last week';
    } else if (kind !== 'today') {
      status = 'moved';
      statusLabel = `Moved from ${dayName(session.movedFrom)}`;
    } else {
      subtitle = `${plannedLine} · moved from ${dayName(session.movedFrom)}`;
    }
  }

  const movable = canMove && (kind === 'upcoming' || kind === 'missed');
  // Past weeks are read-only: only finished sessions open (their log).
  const tappable = kind === 'done' || (canMove && (kind === 'today' || kind === 'upcoming' || kind === 'missed'));

  return (
    <SessionCard
      day={day}
      date={num}
      title={session.name}
      subtitle={subtitle}
      status={status}
      statusLabel={statusLabel}
      onPress={tappable ? () => onOpen(session) : undefined}
      action={
        movable
          ? { icon: 'move', accessibilityLabel: `Move ${session.name} to another day`, onPress: () => onMove(session) }
          : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: screenGutter, paddingTop: 16, paddingBottom: 24, gap: 12 },
  loader: { marginTop: 40 },
  days: { gap: 8 },
  stats: { flexDirection: 'row', gap: 8 },
  cardTight: { padding: 14, borderRadius: 14 },
  note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textTertiary },
  message: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  readOnly: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textTertiary },
});
