import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../theme';
import { Badge, type BadgeTone } from './Badge';
import { Button } from './Button';
import { Icon } from './Icon';

export type ChangeLineKind = 'remove' | 'add' | 'result';
export type ChangeLine = { kind: ChangeLineKind; text: string };
export type ChangeStatus = 'pending' | 'applied' | 'declined';

export type CoachChangeCardProps = {
  lines: readonly ChangeLine[];
  status: ChangeStatus;
  footnote?: string;
  title?: string;
  /**
   * program: a proposed change to the active plan (Apply / Decline, then Undo).
   * draft:   a tweak already made to an unconfirmed plan (See updated plan + Undo;
   *          once undone, Redo). Status "applied" = made, "pending" = undone.
   */
  mode?: 'program' | 'draft';
  onApply?: () => void;
  onDecline?: () => void;
  // Shown once applied or declined.
  onUndo?: () => void;
  // Draft mode: open the plan page on the tweaked plan.
  onSeePlan?: () => void;
};

const SYMBOL: Record<ChangeLineKind, { char: string; color: string; spoken: string }> = {
  remove: { char: '−', color: colors.accentText, spoken: 'Remove' },
  add: { char: '+', color: colors.doneText, spoken: 'Add' },
  result: { char: '=', color: colors.textSecondary, spoken: 'Result' },
};

const STATUS: Record<ChangeStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Pending', tone: 'attention' },
  applied: { label: 'Applied', tone: 'done' },
  declined: { label: 'Declined', tone: 'neutral' },
};

// Draft tweaks are made straight away, so their states read differently.
const DRAFT_STATUS: Record<ChangeStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Undone', tone: 'neutral' },
  applied: { label: 'Made', tone: 'done' },
  declined: { label: 'Undone', tone: 'neutral' },
};

export function CoachChangeCard({
  lines,
  status,
  footnote,
  title,
  mode = 'program',
  onApply,
  onDecline,
  onUndo,
  onSeePlan,
}: CoachChangeCardProps) {
  const draft = mode === 'draft';
  const s = (draft ? DRAFT_STATUS : STATUS)[status];
  const heading = title ?? (draft ? 'Change made to your plan' : 'Proposed change');
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {heading}
        </Text>
        <Badge label={s.label} tone={s.tone} />
      </View>
      <View style={styles.lines}>
        {lines.map((l, i) => {
          const sym = SYMBOL[l.kind];
          return (
            <View key={i} style={styles.line} accessible accessibilityLabel={`${sym.spoken}: ${l.text}`}>
              <Text style={[styles.symbol, { color: sym.color }]}>{sym.char}</Text>
              <Text style={[styles.lineText, l.kind === 'result' && styles.lineResult]}>{l.text}</Text>
            </View>
          );
        })}
      </View>
      {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
      {draft ? (
        <View style={styles.buttons}>
          {status === 'applied' ? (
            <>
              <Button label="Undo" size="compact" variant="secondary" onPress={onUndo} style={styles.flex} accessibilityLabel="Undo this change" />
              <Button label="See updated plan" size="compact" onPress={onSeePlan} style={styles.flex} />
            </>
          ) : (
            <Button label="Redo" size="compact" variant="secondary" onPress={onApply} style={styles.flex} accessibilityLabel="Make this change again" />
          )}
        </View>
      ) : status === 'pending' ? (
        <View style={styles.buttons}>
          <Button label="Decline" size="compact" variant="secondary" onPress={onDecline} style={styles.flex} />
          <Button label="Apply change" size="compact" onPress={onApply} style={styles.flex} />
        </View>
      ) : onUndo ? (
        <Button label="Undo" variant="text" size="sm" onPress={onUndo} accessibilityLabel={`Undo ${s.label.toLowerCase()} change`} />
      ) : null}
    </View>
  );
}

export type SuccessBannerProps = { label: string };

// Green confirmation strip, e.g. "Applied · plan v3 is live".
export function SuccessBanner({ label }: SuccessBannerProps) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Icon name="check" size={18} strokeWidth={2.5} color={colors.doneText} />
      <Text style={styles.bannerText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.text },
  lines: { gap: 8 },
  line: { flexDirection: 'row', gap: 8 },
  symbol: { width: 16, fontFamily: fonts.bold, fontSize: 14, lineHeight: 20 },
  lineText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text },
  lineResult: { color: colors.textSecondary },
  footnote: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textTertiary },
  buttons: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: colors.doneSoft,
  },
  bannerText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.doneText },
});
