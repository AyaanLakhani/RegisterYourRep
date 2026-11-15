// Bottom sheets used by the workout screen (RYR-24): skip reason, swap
// alternatives, reps for a set, and the more-options menu.
import type { ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, useQuery, type ExerciseCatalogEntry, type SkipReason } from '../api';
import { Button, Icon, IconButton, type IconName } from '../components';
import { colors, fonts, radius, screenGutter, type } from '../theme';

type SheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
};

export function Sheet({ visible, title, subtitle, onClose, children }: SheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <IconButton icon="close" accessibilityLabel="Close" onPress={onClose} tone="raised" />
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

type OptionProps = {
  label: string;
  detail?: string;
  icon?: IconName;
  onPress: () => void;
  tone?: 'default' | 'accent';
};

export function SheetOption({ label, detail, icon, onPress, tone = 'default' }: OptionProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      style={({ pressed }) => [styles.option, pressed && styles.pressed]}
    >
      {icon && <Icon name={icon} size={18} color={tone === 'accent' ? colors.accent : colors.textMuted} />}
      <View style={styles.optionText}>
        <Text style={[styles.optionLabel, tone === 'accent' && styles.optionLabelAccent]}>{label}</Text>
        {detail ? <Text style={styles.optionDetail}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

// --- Skip ------------------------------------------------------------------

export const SKIP_REASONS: { reason: SkipReason; label: string; short: string }[] = [
  { reason: 'no_equipment', label: 'No equipment', short: 'no equipment' },
  { reason: 'didnt_know', label: "Didn't know it", short: "didn't know it" },
  { reason: 'pain', label: 'Pain', short: 'pain' },
  { reason: 'time', label: 'Short on time', short: 'short on time' },
];

export const skipReasonText = (reason: SkipReason) => SKIP_REASONS.find((r) => r.reason === reason)?.short ?? '';

export function SkipSheet({
  exerciseName,
  onPick,
  onClose,
}: {
  exerciseName: string | null;
  onPick: (reason: SkipReason) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={exerciseName !== null} title={`Skip ${exerciseName ?? ''}`} subtitle="Why are you skipping it?" onClose={onClose}>
      <View style={styles.list}>
        {SKIP_REASONS.map((r) => (
          <SheetOption key={r.reason} label={r.label} onPress={() => onPick(r.reason)} />
        ))}
      </View>
    </Sheet>
  );
}

// --- Swap ------------------------------------------------------------------

const EQUIPMENT_LABEL: Record<string, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  machine: 'Machine',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell',
  band: 'Band',
  bench: 'Bench',
  pullup_bar: 'Pull-up bar',
};

function altDetail(e: ExerciseCatalogEntry) {
  const muscles = e.muscles.map((m) => m.replace('_', ' ')).join(', ');
  const equipment = e.equipment.map((q) => EQUIPMENT_LABEL[q] ?? q).join(', ');
  return [muscles, equipment].filter(Boolean).join(' · ');
}

export function SwapSheet({
  exercise,
  excludeIds,
  onPick,
  onClose,
}: {
  exercise: { exerciseId: string; name: string } | null;
  excludeIds: readonly string[];
  onPick: (alt: ExerciseCatalogEntry) => void;
  onClose: () => void;
}) {
  const exerciseId = exercise?.exerciseId;
  const { data, loading, error, refetch } = useQuery(
    () => (exerciseId ? api.getAlternatives(exerciseId) : Promise.resolve([])),
    [exerciseId],
  );
  const options = (data ?? []).filter((e) => !excludeIds.includes(e.id));

  return (
    <Sheet
      visible={exercise !== null}
      title={`Swap ${exercise?.name ?? ''}`}
      subtitle="Same muscles, just for today."
      onClose={onClose}
    >
      {loading && !data ? (
        <ActivityIndicator color={colors.accent} style={styles.status} accessibilityLabel="Loading alternatives" />
      ) : error ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>Couldn't load alternatives. Check your connection.</Text>
          <Button label="Try again" variant="secondary" size="sm" onPress={refetch} />
        </View>
      ) : options.length === 0 ? (
        <Text style={[styles.statusText, styles.status]}>No alternatives for this one.</Text>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
          {options.map((alt) => (
            <SheetOption key={alt.id} icon="swap" label={alt.name} detail={altDetail(alt)} onPress={() => onPick(alt)} />
          ))}
        </ScrollView>
      )}
    </Sheet>
  );
}

// --- Reps for one set ------------------------------------------------------

export function RepsSheet({
  target,
  value,
  onChange,
  onSave,
  onClear,
  onClose,
}: {
  target: { exerciseName: string; setIndex: number; logged: boolean } | null;
  value: number;
  onChange: (n: number) => void;
  onSave: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={target !== null} title={`Set ${(target?.setIndex ?? 0) + 1}`} subtitle={target?.exerciseName} onClose={onClose}>
      <View style={styles.stepper}>
        <Button
          label={'−'}
          variant="secondary"
          size="sm"
          style={styles.stepButton}
          accessibilityLabel="One rep fewer"
          onPress={() => onChange(Math.max(0, value - 1))}
        />
        <View style={styles.stepperValue} accessible accessibilityLabel={`${value} reps`} accessibilityLiveRegion="polite">
          <Text style={styles.stepperNumber}>{value}</Text>
          <Text style={styles.optionDetail}>reps</Text>
        </View>
        <Button
          label="+"
          variant="secondary"
          size="sm"
          style={styles.stepButton}
          accessibilityLabel="One rep more"
          onPress={() => onChange(value + 1)}
        />
      </View>
      <View style={styles.list}>
        <Button label="Save set" onPress={onSave} />
        {target?.logged ? <Button label="Clear set" variant="text" size="sm" onPress={onClear} /> : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.background, opacity: 0.7 },
  panel: {
    gap: 16,
    paddingTop: 8,
    paddingHorizontal: screenGutter,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
    maxHeight: '80%',
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: radius.pill, backgroundColor: colors.borderStrong },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerText: { flex: 1, gap: 2, paddingTop: 4 },
  title: { ...type.heading, color: colors.text },
  subtitle: { ...type.bodySmall, color: colors.textSecondary },
  scroll: { flexGrow: 0 },
  list: { gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.raised,
  },
  pressed: { opacity: 0.8 },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.text },
  optionLabelAccent: { color: colors.accentText },
  optionDetail: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  status: { paddingVertical: 24 },
  statusBox: { gap: 12, paddingVertical: 12 },
  statusText: { ...type.bodySmall, color: colors.textSecondary, textAlign: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  stepButton: { width: 56 },
  stepperValue: { alignItems: 'center', minWidth: 80 },
  stepperNumber: { fontFamily: fonts.display, fontSize: 40, lineHeight: 48, color: colors.text },
});
