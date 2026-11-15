// Bottom sheets used by the Week tab: pick a day to move a session to, and a
// read-only log of a finished session.
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DayDate, ExerciseLog, Session, SkipReason } from '../../api';
import { Badge, Button, IconButton } from '../../components';
import { colors, fonts, radius, screenGutter } from '../../theme';
import { dayName, dayOfMonth } from './dates';
import { exerciseCounts, sessionMinutes } from './model';

type SheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
};

function Sheet({ visible, title, subtitle, onClose, children }: SheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <IconButton icon="close" accessibilityLabel="Close" onPress={onClose} />
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

// --- Move -----------------------------------------------------------------

type MoveSheetProps = {
  session: Session | null;
  targets: DayDate[];
  busy: boolean;
  error?: string;
  onPick: (date: DayDate) => void;
  onClose: () => void;
};

export function MoveSheet({ session, targets, busy, error, onPick, onClose }: MoveSheetProps) {
  return (
    <Sheet
      visible={session !== null}
      title={session ? `Move ${session.name}` : ''}
      subtitle={session ? `Now on ${dayName(session.date)} ${dayOfMonth(session.date)}. Pick a free day this week.` : undefined}
      onClose={onClose}
    >
      {targets.length === 0 ? (
        <Text style={styles.empty}>No free days left this week.</Text>
      ) : (
        <View style={styles.list}>
          {targets.map((date) => (
            <Button
              key={date}
              label={`${dayName(date)} ${dayOfMonth(date)}`}
              variant="secondary"
              size="compact"
              disabled={busy}
              onPress={() => onPick(date)}
              accessibilityLabel={`Move to ${dayName(date)} ${dayOfMonth(date)}`}
            />
          ))}
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Sheet>
  );
}

// --- Session log ----------------------------------------------------------

const SKIP_TEXT: Record<SkipReason, string> = {
  no_equipment: 'no equipment free',
  didnt_know: "didn't know it",
  pain: 'it hurt',
  time: 'ran out of time',
};

type LogSheetProps = { session: Session | null; onClose: () => void };

export function SessionLogSheet({ session, onClose }: LogSheetProps) {
  const counts = session ? exerciseCounts(session) : null;
  return (
    <Sheet
      visible={session !== null}
      title={session ? session.name : ''}
      subtitle={
        session && counts
          ? `${dayName(session.date)} ${dayOfMonth(session.date)} · ${counts.done} of ${counts.total} done · ${sessionMinutes(session)} min`
          : undefined
      }
      onClose={onClose}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
        {session?.exercises.map((e) => {
          const log: ExerciseLog | undefined = session.logs.find((l) => l.exerciseId === e.exerciseId);
          return (
            <View key={e.exerciseId} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, log?.status !== 'done' && styles.rowTitleMuted]}>{e.name}</Text>
                <Text style={styles.rowMeta}>
                  {log?.status === 'skipped'
                    ? `Skipped: ${SKIP_TEXT[log.reason]}`
                    : `${e.sets} × ${e.reps}`}
                </Text>
              </View>
              {log?.status === 'done' ? (
                <Badge label="Done" tone="done" icon="check" />
              ) : log?.status === 'skipped' ? (
                <Badge label="Skipped" tone="neutral" />
              ) : (
                <Badge label="Not logged" tone="neutral" />
              )}
            </View>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.background, opacity: 0.75 },
  sheet: {
    maxHeight: '80%',
    gap: 16,
    paddingTop: 16,
    paddingHorizontal: screenGutter,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  scroll: { flexGrow: 0 },
  list: { gap: 8 },
  empty: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary },
  error: { fontFamily: fonts.regular, fontSize: 13, color: colors.attention },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.text },
  rowTitleMuted: { color: colors.textSecondary },
  rowMeta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
});
