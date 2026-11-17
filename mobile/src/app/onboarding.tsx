// Onboarding coach interview (RYR-20).
//
// Seven steps on one layout (updated Nov 15, Questions & Decisions: "How does
// the coach tell beginner, intermediate and pro apart?"):
//   1 goal, days, session length   2 where you train (gym type)
//   3 confirm equipment (preset from the gym type)   4 training history
//   5 exercise familiarity (only what the equipment allows)
//   6 injuries and limitations     7 suggested starting level, confirmed
// Each step: back + "Step N of 7", the previous answer echoed as a muted chat
// bubble, the coach's question, answer chips, then Continue. Answers live in
// one state object so going back keeps them. The last step saves a structured
// Profile and starts plan generation.
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  api,
  GYM_TYPE_PRESETS,
  suggestLevel,
  useQuery,
  type Equipment,
  type ExerciseCatalogEntry,
  type Goal,
  type GymType,
  type Level,
  type ProfileInput,
  type TrainingHistory,
  type Weekday,
} from '../api';
import { rememberOnboardingFinished } from '../auth/onboardingMemory';
import { Button, ChatBubble, Chip, CoachAvatar, Icon, IconButton, StepProgress } from '../components';
import { colors, fonts, radius, screenGutter, sizes } from '../theme';

const TOTAL_STEPS = 7;
// The last step confirms the level and lists every answer so it can be changed.
const LEVEL_STEP = TOTAL_STEPS - 1;
const STEP = { schedule: 0, gym: 1, equipment: 2, history: 3, familiarity: 4, limits: 5, level: 6 } as const;

// --- Answer options (UI labels for the ProfileInput enums) -------------------

const GOALS: { value: Goal; label: string }[] = [
  { value: 'build_muscle', label: 'Build muscle' },
  { value: 'get_stronger', label: 'Get stronger' },
  { value: 'lose_fat', label: 'Lose fat' },
  { value: 'general_fitness', label: 'General fitness' },
  { value: 'endurance', label: 'Build endurance' },
];

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
];

const SESSION_MINUTES = [30, 45, 60, 75, 90];

// Picking a gym type pre-ticks its preset equipment (api/level.ts) on the next
// step, where the user unticks what theirs lacks.
const GYM_TYPES: { value: GymType; label: string; equipmentHelper: string }[] = [
  {
    value: 'home',
    label: 'Home',
    equipmentHelper: "Home setups vary a lot, so tick what you own. Bodyweight moves are always on the table.",
  },
  {
    value: 'apartment_gym',
    label: 'Apartment gym',
    equipmentHelper: "Apartment gyms usually have these. Untick anything yours doesn't, and tick anything extra.",
  },
  {
    value: 'community_center',
    label: 'Community center',
    equipmentHelper: "Community centers usually have these. Untick anything yours doesn't, and tick anything extra.",
  },
  {
    value: 'commercial_gym',
    label: 'Commercial gym',
    equipmentHelper: "Commercial gyms usually have all of this. Untick anything yours doesn't.",
  },
];

const EQUIPMENT: { value: Equipment; label: string }[] = [
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbells' },
  { value: 'bench', label: 'Bench' },
  { value: 'cable', label: 'Cable machine' },
  { value: 'machine', label: 'Weight machines' },
  { value: 'smith_machine', label: 'Smith machine' },
  { value: 'pullup_bar', label: 'Pull-up bar' },
  { value: 'kettlebell', label: 'Kettlebells' },
  { value: 'band', label: 'Resistance bands' },
  { value: 'bodyweight', label: 'Bodyweight' },
];

const HISTORY: { value: TrainingHistory; label: string }[] = [
  { value: 'under_6_months', label: 'Under 6 months' },
  { value: 'six_months_to_2_years', label: '6 months to 2 years' },
  { value: 'over_2_years', label: '2+ years' },
];

const LEVELS: { value: Level; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'pro', label: 'Pro' },
];

const LIMIT_AREAS = ['Knees', 'Lower back', 'Shoulders', 'Wrists', 'Hips', 'Neck'];

// --- Answers -----------------------------------------------------------------

type Answers = {
  goal?: Goal;
  days: Weekday[];
  minutes?: number;
  gymType?: GymType;
  equipment: Equipment[];
  history?: TrainingHistory;
  familiar: string[];
  limitAreas: string[];
  limitText: string;
  /** Set only when the user picks a level other than the suggested one. */
  levelChoice?: Level;
};

const EMPTY: Answers = { days: [], equipment: [], familiar: [], limitAreas: [], limitText: '' };

const toggle = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

const labelOf = <T extends string>(options: { value: T; label: string }[], value: T | undefined) =>
  options.find((o) => o.value === value)?.label ?? '';

function minutesPhrase(m: number) {
  if (m === 60) return 'about an hour';
  if (m === 90) return 'about an hour and a half';
  return `about ${m} minutes`;
}

const daysPhrase = (n: number) => `${n} ${n === 1 ? 'day' : 'days'} a week`;

function scheduleSummary(a: Answers) {
  const parts = [];
  if (a.days.length) parts.push(daysPhrase(a.days.length));
  if (a.minutes) parts.push(minutesPhrase(a.minutes));
  return parts.join(' · ');
}

function goalAndSchedule(a: Answers) {
  return [labelOf(GOALS, a.goal), scheduleSummary(a)].filter(Boolean).join(' · ');
}

function equipmentList(a: Answers) {
  const names = EQUIPMENT.filter((e) => a.equipment.includes(e.value)).map((e) => e.label.toLowerCase());
  const head = names.slice(0, 2).join(', ');
  return names.length > 2 ? `${head} and ${names.length - 2} more` : head;
}

function equipmentSummary(a: Answers) {
  return [labelOf(GYM_TYPES, a.gymType), equipmentList(a)].filter(Boolean).join(' · ');
}

// Ticks the current equipment still allows (equipment can change after ticking).
const familiarStillOffered = (a: Answers, options: ExerciseCatalogEntry[] | undefined) =>
  options ? a.familiar.filter((id) => options.some((o) => o.id === id)) : a.familiar;

function familiaritySummary(a: Answers, options: ExerciseCatalogEntry[] | undefined) {
  const ids = familiarStillOffered(a, options);
  if (ids.length === 0) return "I'm new to all of these";
  const names = (options ?? []).filter((o) => ids.includes(o.id)).map((o) => o.name);
  if (names.length === 0 || names.length > 3) return `I know ${ids.length} of these`;
  return `I know ${names.join(', ')}`;
}

const suggestedLevelOf = (a: Answers, options: ExerciseCatalogEntry[] | undefined) =>
  suggestLevel(a.history ?? 'under_6_months', familiarStillOffered(a, options).length);

function limitationsText(a: Answers) {
  const areas = a.limitAreas.join(', ');
  const text = a.limitText.trim();
  return [areas, text].filter(Boolean).join('. ');
}

const limitationsSummary = (a: Answers) => limitationsText(a) || 'Nothing to work around';

function toProfileInput(a: Answers, options: ExerciseCatalogEntry[] | undefined): ProfileInput {
  const suggestedLevel = suggestedLevelOf(a, options);
  return {
    goals: a.goal ? [a.goal] : [],
    // Keep the week in calendar order whatever order the chips were tapped.
    trainingDays: WEEKDAYS.map((d) => d.value).filter((d) => a.days.includes(d)),
    sessionMinutes: a.minutes ?? 60,
    gymType: a.gymType ?? 'commercial_gym',
    equipment: a.equipment,
    trainingHistory: a.history ?? 'under_6_months',
    familiarExerciseIds: familiarStillOffered(a, options),
    limitations: limitationsText(a).slice(0, 1000),
    suggestedLevel,
    level: a.levelChoice ?? suggestedLevel,
  };
}

function isStepValid(step: number, a: Answers) {
  switch (step) {
    case STEP.schedule:
      return !!a.goal && a.days.length > 0 && !!a.minutes;
    case STEP.gym:
      return !!a.gymType;
    case STEP.history:
      return !!a.history;
    default:
      return true;
  }
}

// --- Screen ------------------------------------------------------------------

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  // Set when the user jumps from the review step to change one answer.
  const [editingFromReview, setEditingFromReview] = useState(false);
  const [demo, setDemo] = useState<ExerciseCatalogEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();

  // Only exercises the confirmed equipment allows. Reloads when the equipment changes.
  const equipmentKey = [...answers.equipment].sort().join(',');
  const familiarity = useQuery(() => api.getFamiliarityOptions(answers.equipment), [equipmentKey]);

  const scrollRef = useRef<ScrollViewInstance>(null);
  const inputFocused = useRef(false);

  const update = (patch: Partial<Answers>) => setAnswers((prev) => ({ ...prev, ...patch }));

  // Start each step at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  // Keep the text field above the keyboard: the KeyboardAvoidingView shrinks
  // the scroll area, then we scroll the field (always last) into view.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      if (inputFocused.current) scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);

  const canGoBackFromStart = router.canGoBack();

  const goBack = () => {
    // Nothing can change while the answers are being saved.
    if (saving) return;
    Keyboard.dismiss();
    setEditingFromReview(false);
    if (step > 0) setStep(step - 1);
    else if (router.canGoBack()) router.back();
  };

  // Android hardware back steps through the interview first.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 0) return false;
      goBack();
      return true;
    });
    return () => sub.remove();
  });

  const goNext = () => {
    Keyboard.dismiss();
    if (editingFromReview && step === STEP.gym) {
      // A changed gym type resets the equipment, so confirm it before going back.
      setStep(STEP.equipment);
    } else if (editingFromReview) {
      setEditingFromReview(false);
      setStep(LEVEL_STEP);
    } else {
      setStep(Math.min(step + 1, LEVEL_STEP));
    }
  };

  const editStep = (target: number) => {
    if (saving) return;
    setEditingFromReview(true);
    setStep(target);
  };

  const submit = async () => {
    setSaving(true);
    setSaveError(undefined);
    try {
      await api.saveProfile(toProfileInput(answers, familiarity.data));
      await rememberOnboardingFinished();
      const job = await api.startGeneration();
      router.replace({ pathname: '/generating', params: { jobId: job.id } });
    } catch {
      setSaveError("I couldn't save your answers. Check your connection and try again.");
      setSaving(false);
    }
  };

  const onContinue = step === LEVEL_STEP ? submit : goNext;
  const suggested = suggestedLevelOf(answers, familiarity.data);
  const level = answers.levelChoice ?? suggested;

  // --- Per-step content ------------------------------------------------------

  let echo: string | undefined;
  let heading: string;
  let helper: string;
  let body: ReactNode;
  let secondary: { label: string; onPress: () => void } | undefined;

  switch (step) {
    case STEP.schedule:
      heading = 'What are you training for, and when?';
      helper = "Pick what matters most right now, the days that usually work and how long you've got.";
      body = (
        <>
          <Group label="Goal">
            <ChipRow>
              {GOALS.map((g) => (
                <Chip key={g.value} label={g.label} selected={answers.goal === g.value} onPress={() => update({ goal: g.value })} />
              ))}
            </ChipRow>
          </Group>
          <Group label="Days">
            <ChipRow>
              {WEEKDAYS.map((d) => (
                <Chip
                  key={d.value}
                  label={d.label}
                  selected={answers.days.includes(d.value)}
                  onPress={() => update({ days: toggle(answers.days, d.value) })}
                />
              ))}
            </ChipRow>
          </Group>
          <Group label="Session length">
            <ChipRow>
              {SESSION_MINUTES.map((m) => (
                <Chip key={m} label={`${m} min`} selected={answers.minutes === m} onPress={() => update({ minutes: m })} />
              ))}
            </ChipRow>
          </Group>
        </>
      );
      break;

    case STEP.gym:
      echo = goalAndSchedule(answers);
      heading = 'Where do you train?';
      helper = "Pick the closest match. You'll confirm the equipment next.";
      body = (
        <ChipRow>
          {GYM_TYPES.map((g) => (
            <Chip
              key={g.value}
              label={g.label}
              selected={answers.gymType === g.value}
              // A new gym type resets the equipment to that type's preset.
              onPress={() => answers.gymType !== g.value && update({ gymType: g.value, equipment: GYM_TYPE_PRESETS[g.value] })}
            />
          ))}
        </ChipRow>
      );
      break;

    case STEP.equipment:
      echo = labelOf(GYM_TYPES, answers.gymType);
      heading = 'Confirm your equipment';
      helper = GYM_TYPES.find((g) => g.value === answers.gymType)?.equipmentHelper ?? 'Tick what you can use.';
      body = (
        <ChipRow>
          {EQUIPMENT.map((e) => (
            <Chip
              key={e.value}
              label={e.label}
              selected={answers.equipment.includes(e.value)}
              onPress={() => update({ equipment: toggle(answers.equipment, e.value) })}
            />
          ))}
        </ChipRow>
      );
      break;

    case STEP.history:
      echo = equipmentList(answers) || 'Bodyweight only';
      heading = 'How long have you trained consistently?';
      helper = 'Count the time you trained most weeks. Breaks reset the clock.';
      body = (
        <ChipRow>
          {HISTORY.map((h) => (
            <Chip key={h.value} label={h.label} selected={answers.history === h.value} onPress={() => update({ history: h.value })} />
          ))}
        </ChipRow>
      );
      break;

    case STEP.familiarity:
      echo = labelOf(HISTORY, answers.history);
      heading = 'Which of these are you comfortable doing?';
      helper = "Tick any you can do with good form. I'll build your plan around them.";
      body = familiarity.data && familiarity.data.length === 0 ? (
        <Text style={styles.hint}>None of my check-in lifts fit your equipment, so I'll start you with simple moves and teach them as we go.</Text>
      ) : familiarity.data ? (
        <>
          <ChipRow>
            {familiarity.data.map((ex) => (
              <Chip
                key={ex.id}
                label={ex.name}
                selected={answers.familiar.includes(ex.id)}
                onPress={() => update({ familiar: toggle(answers.familiar, ex.id) })}
                onLongPress={() => setDemo(ex)}
                accessibilityHint="Press and hold to see how it's done"
              />
            ))}
          </ChipRow>
          <Text style={styles.hint}>Not sure what one is? Press and hold it to see a demo.</Text>
        </>
      ) : familiarity.error ? (
        <View style={styles.inlineError}>
          <Text style={styles.errorText}>I couldn't load the exercise list.</Text>
          <Button label="Try again" variant="secondary" size="sm" onPress={familiarity.refetch} />
        </View>
      ) : (
        <Text style={styles.hint}>Loading exercises…</Text>
      );
      secondary = {
        label: "I'm new to all of these",
        onPress: () => {
          update({ familiar: [] });
          goNext();
        },
      };
      break;

    case STEP.limits:
      echo = familiaritySummary(answers, familiarity.data);
      heading = 'Anything I should work around?';
      helper = "Injuries, pain or moves you'd rather skip. I'll plan around them.";
      body = (
        <>
          <ChipRow>
            {LIMIT_AREAS.map((area) => (
              <Chip
                key={area}
                label={area}
                selected={answers.limitAreas.includes(area)}
                onPress={() => update({ limitAreas: toggle(answers.limitAreas, area) })}
              />
            ))}
          </ChipRow>
          <View style={styles.field}>
            <Text style={styles.fieldLabel} nativeID="limitations-label">
              Tell me more
            </Text>
            <TextInput
              value={answers.limitText}
              onChangeText={(limitText) => update({ limitText })}
              placeholder="e.g. knee pain on deep squats"
              placeholderTextColor={colors.textTertiary}
              accessibilityLabelledBy="limitations-label"
              accessibilityLabel="Tell me more"
              style={styles.input}
              multiline
              maxLength={900}
              selectionColor={colors.accent}
              onFocus={() => {
                inputFocused.current = true;
              }}
              onBlur={() => {
                inputFocused.current = false;
              }}
            />
          </View>
        </>
      );
      secondary = {
        label: 'Nothing to work around',
        onPress: () => {
          update({ limitAreas: [], limitText: '' });
          goNext();
        },
      };
      break;

    default:
      echo = limitationsSummary(answers);
      heading = `Based on this, we'll start you as ${labelOf(LEVELS, suggested)}. Sound right?`;
      helper = 'Pick a different level if that feels off. Your weekly progress can move you up later.';
      body = (
        <>
          <Group label="Starting level">
            <ChipRow>
              {LEVELS.map((l) => (
                <Chip
                  key={l.value}
                  label={l.label}
                  selected={level === l.value}
                  disabled={saving}
                  onPress={() => update({ levelChoice: l.value === suggested ? undefined : l.value })}
                />
              ))}
            </ChipRow>
          </Group>
          <Group label="Your answers">
            <View style={styles.review}>
              <ReviewRow label="Goal and schedule" value={goalAndSchedule(answers)} disabled={saving} onPress={() => editStep(STEP.schedule)} />
              <ReviewRow label="Where you train" value={equipmentSummary(answers)} disabled={saving} onPress={() => editStep(STEP.gym)} />
              <ReviewRow label="Training history" value={labelOf(HISTORY, answers.history)} disabled={saving} onPress={() => editStep(STEP.history)} />
              <ReviewRow
                label="Exercises you know"
                value={familiaritySummary(answers, familiarity.data)}
                disabled={saving} onPress={() => editStep(STEP.familiarity)}
              />
              <ReviewRow label="Work around" value={limitationsSummary(answers)} disabled={saving} onPress={() => editStep(STEP.limits)} last />
            </View>
          </Group>
        </>
      );
      break;
  }

  const continueLabel = step === LEVEL_STEP ? (saving ? 'Saving…' : 'Build my plan') : 'Continue';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <View style={styles.header}>
          {step > 0 || canGoBackFromStart ? (
            <IconButton icon="back" accessibilityLabel="Back" onPress={goBack} disabled={saving} />
          ) : (
            <View style={styles.backSpacer} />
          )}
          <View style={styles.progress}>
            <Text style={styles.stepLabel}>
              Step {step + 1} of {TOTAL_STEPS}
            </Text>
            <StepProgress
              steps={Array.from({ length: TOTAL_STEPS }, (_, i) => (i <= step ? 'filled' : 'empty'))}
              accessibilityLabel={`Step ${step + 1} of ${TOTAL_STEPS}`}
            />
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.main}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {!!echo && <ChatBubble from="user" tone="muted" text={echo} />}

          <View style={styles.question}>
            <CoachAvatar />
            <View style={styles.questionText}>
              <Text style={styles.heading} accessibilityRole="header">
                {heading}
              </Text>
              <Text style={styles.helper}>{helper}</Text>
            </View>
          </View>

          {body}
        </ScrollView>

        <View style={styles.footer}>
          {!!saveError && (
            <Text style={[styles.errorText, styles.footerError]} accessibilityLiveRegion="polite">
              {saveError}
            </Text>
          )}
          <Button label={continueLabel} onPress={onContinue} disabled={!isStepValid(step, answers) || saving} />
          {secondary && (
            <Pressable
              onPress={secondary.onPress}
              accessibilityRole="button"
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryLabel}>{secondary.label}</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>

      <DemoSheet exercise={demo} onClose={() => setDemo(null)} />
    </SafeAreaView>
  );
}

// --- Pieces ------------------------------------------------------------------

function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chips}>{children}</View>;
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ReviewRow({
  label,
  value,
  onPress,
  last = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onPress: () => void;
  last?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled }}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityHint="Change this answer"
      style={({ pressed }) => [styles.reviewRow, !last && styles.reviewDivider, pressed && styles.pressed]}
    >
      <View style={styles.reviewText}>
        <Text style={styles.reviewLabel}>{label}</Text>
        <Text style={styles.reviewValue}>{value}</Text>
      </View>
      <Icon name="forward" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

const muscleName = (m: string) => m.replace('_', ' ');

// Press-and-hold demo. No design yet: a bottom sheet with the name and a form cue.
function DemoSheet({ exercise, onClose }: { exercise: ExerciseCatalogEntry | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  // Keep the last exercise while the sheet fades out.
  const [shown, setShown] = useState(exercise);
  useEffect(() => {
    if (exercise) setShown(exercise);
  }, [exercise]);

  return (
    <Modal visible={!!exercise} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.sheetRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        {shown && (
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]} accessibilityViewIsModal>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle} accessibilityRole="header">
              {shown.name}
            </Text>
            <Text style={styles.sheetMuscles}>Works {shown.muscles.map(muscleName).join(', ')}</Text>
            {!!shown.formCue && <Text style={styles.sheetCue}>{shown.formCue}</Text>}
            <Button label="Got it" variant="secondary" onPress={onClose} style={styles.sheetButton} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
    paddingHorizontal: screenGutter,
    paddingBottom: 8,
  },
  backSpacer: { width: sizes.minTapTarget, height: sizes.minTapTarget },
  progress: { flex: 1, gap: 6 },
  stepLabel: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, color: colors.textSecondary },

  main: { paddingVertical: 16, paddingHorizontal: screenGutter, gap: 16 },

  question: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  questionText: { flex: 1, gap: 6 },
  heading: { fontFamily: fonts.display, fontSize: 24, lineHeight: 29, color: colors.text },
  helper: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textSecondary },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textTertiary },

  field: { gap: 8, marginTop: 4 },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.text },
  input: {
    minHeight: sizes.inputHeight,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 13,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 20,
    textAlignVertical: 'top',
  },

  review: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: sizes.minTapTarget,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  reviewDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  reviewText: { flex: 1, gap: 2 },
  reviewLabel: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  reviewValue: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.text },

  inlineError: { gap: 12, alignItems: 'flex-start' },
  errorText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.attention },
  footerError: { marginBottom: 8 },

  footer: { paddingTop: 12, paddingHorizontal: screenGutter, paddingBottom: 12, gap: 4 },
  secondary: { height: sizes.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
  pressed: { opacity: 0.7 },

  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.background, opacity: 0.75 },
  sheet: {
    gap: 8,
    paddingTop: 10,
    paddingHorizontal: screenGutter,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    marginBottom: 8,
  },
  sheetTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.text },
  sheetMuscles: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.accentText },
  sheetCue: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.textSubtle },
  sheetButton: { marginTop: 12 },
});
