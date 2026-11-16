import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../theme';
import { Badge } from './Badge';
import type { IconName } from './Icon';
import { IconButton } from './IconButton';

// upcoming = a planned session with no pill.
export type SessionStatus = 'today' | 'done' | 'moved' | 'skipped' | 'rest' | 'upcoming';

export type SessionCardAction = {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
};

export type SessionCardProps = {
  day: string; // "Thu"
  date: string | number; // 12
  title?: string; // defaults to "Rest day" for rest
  subtitle?: string;
  status?: SessionStatus;
  // Overrides the pill text, e.g. "Moved from Wed".
  statusLabel?: string;
  onPress?: () => void;
  // Trailing icon button, e.g. the move button on Week.
  action?: SessionCardAction;
};

const DEFAULT_LABEL: Partial<Record<SessionStatus, string>> = {
  today: 'Today',
  done: 'Done',
  moved: 'Moved',
  skipped: 'Skipped',
};

export function SessionCard({
  day,
  date,
  title,
  subtitle,
  status = 'upcoming',
  statusLabel,
  onPress,
  action,
}: SessionCardProps) {
  const rest = status === 'rest';
  const skipped = status === 'skipped';
  const today = status === 'today';
  const name = title ?? (rest ? 'Rest day' : '');
  const pillLabel = statusLabel ?? DEFAULT_LABEL[status];

  const body = (
    <>
      <View style={styles.dateCol}>
        <Text style={[styles.day, today && styles.dayToday, rest && styles.restText]}>{day}</Text>
        <Text style={[styles.date, rest && styles.restText]}>{date}</Text>
      </View>
      {rest ? (
        <Text style={styles.restTitle}>{name}</Text>
      ) : (
        <View style={styles.textCol}>
          <Text style={[styles.title, skipped && styles.titleSkipped]} numberOfLines={1}>
            {name}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, skipped && styles.subtitleSkipped]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      )}
      {pillLabel ? (
        <Badge
          label={pillLabel}
          tone={today ? 'accent' : status === 'done' ? 'done' : status === 'moved' ? 'attention' : 'neutral'}
          icon={status === 'done' ? 'check' : undefined}
        />
      ) : null}
    </>
  );

  const a11yLabel = [`${day} ${date}`, name, subtitle, pillLabel].filter(Boolean).join(', ');

  return (
    <View style={[styles.card, rest ? styles.cardRest : skipped ? styles.cardSkipped : today ? styles.cardToday : null]}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
          style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={styles.main} accessible accessibilityLabel={a11yLabel}>
          {body}
        </View>
      )}
      {action && (
        <IconButton icon={action.icon} accessibilityLabel={action.accessibilityLabel} onPress={action.onPress} tone="raised" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardToday: { borderColor: colors.accent },
  cardSkipped: { borderStyle: 'dashed', borderColor: colors.borderStrong },
  cardRest: { backgroundColor: 'transparent', borderColor: 'transparent', paddingVertical: 10 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  pressed: { opacity: 0.8 },
  dateCol: { width: 40, alignItems: 'center' },
  day: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  dayToday: { fontFamily: fonts.bold, color: colors.accent },
  date: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 24, color: colors.text },
  restText: { color: colors.textTertiary },
  textCol: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.text },
  titleSkipped: { color: colors.textSecondary },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  subtitleSkipped: { color: colors.textTertiary },
  restTitle: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.textTertiary },
});
