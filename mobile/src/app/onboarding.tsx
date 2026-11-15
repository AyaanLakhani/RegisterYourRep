// Onboarding coach interview (RYR-20).
//
// Six steps on one layout: back + "Step N of 6", the previous answer echoed as
// a muted chat bubble, the coach's question, answer chips, an optional text
// field, then Continue. Answers live in one state object so going back keeps
// them. The last step saves a structured Profile and starts plan generation.
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
  useQuery,
  type Equipment,
  type ExerciseCatalogEntry,
  type Goal,
  type GymType,
  type ProfileInput,
  type Weekday,
} from '../api';
import { Button, ChatBubble, Chip, CoachAvatar, Icon, IconButton, StepProgress } from '../components';
import { colors, fonts, radius, screenGutter, sizes } from '../theme';

const TOTAL_STEPS = 6;
const REVIEW_STEP = TOTAL_STEPS - 1;

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

const GYM_TYPES: { value: GymType; label: string }[] = [
  { value: 'full_gym', label: 'Full gym' },
  { value: 'home_gym', label: 'Home gym' },
  { value: 'bodyweight_only', label: 'No equipment' },
];

const EQUIPMENT: { value: Equipment; label: string }[] = [
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbells' },
  { value: 'bench', label: 'Bench' },
  { value: 'cable', label: 'Cable machine' },
  { value: 'machine', label: 'Weight machines' },
  { value: 'pullup_bar', label: 'Pull-up bar' },
  { value: 'kettlebell', label: 'Kettlebells' },
  { value: 'band', label: 'Resistance bands' },
  { value: 'bodyweight', label: 'Bodyweight' },
];

// Picking a gym type pre-fills the equipment chips; the user can adjust them.
const EQUIPMENT_FOR_GYM: Record<GymType, Equipment[]> = {
  full_gym: ['barbell', 'dumbbell', 'bench', 'cable', 'machine', 'pullup_bar', 'bodyweight'],
  home_gym: ['dumbbell', 'bench', 'bodyweight'],
  bodyweight_only: ['bodyweight'],
};

const LIMIT_AREAS = ['Knees', 'Lower back', 'Shoulders', 'Wrists', 'Hips', 'Neck'];

// --- Answers -----------------------------------------------------------------

type Answers = {
  goal?: Goal;
  days: Weekday[];
  minutes?: number;
  gymType?: GymType;
  equipment: Equipment[];
  familiar: string[];
  limitAreas: string[];
  limitText: string;
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

function equipmentSummary(a: Answers) {
  const names = EQUIPMENT.filter((e) => a.equipment.includes(e.value)).map((e) => e.label.toLowerCase());
  const head = names.slice(0, 2).join(', ');
  const kit = names.length > 2 ? `${head} and ${names.length - 2} more` : head;
  return [labelOf(GYM_TYPES, a.gymType), kit].filter(Boolean).join(' · ');
}

function familiaritySummary(a: Answers, options: ExerciseCatalogEntry[] | undefined) {
  if (a.familiar.length === 0) return "I'm new to all of these";
  const names = (options ?? []).filter((o) => a.familiar.includes(o.id)).map((o) => o.name);
  if (names.length === 0 || names.length > 3) return `I know ${a.familiar.length} of these`;
  return `I know ${names.join(', ')}`;
}

function limitationsText(a: Answers) {
  const areas = a.limitAreas.join(', ');
  const text = a.limitText.trim();
  return [areas, text].filter(Boolean).join('. ');
}

const limitationsSummary = (a: Answers) => limitationsText(a) || 'Nothing to work around';

function toProfileInput(a: Answers): ProfileInput {
  return {
    goals: a.goal ? [a.goal] : [],
    // Keep the week in calendar order whatever order the chips were tapped.
    trainingDays: WEEKDAYS.map((d) => d.value).filter((d) => a.days.includes(d)),
    sessionMinutes: a.minutes ?? 60,
    gymType: a.gymType ?? 'full_gym',
    equipment: a.equipment,
    familiarExerciseIds: a.familiar,
    limitations: limitationsText(a).slice(0, 1000),
  };
}

function isStepValid(step: number, a: Answers) {
  switch (step) {
    case 0:
      return !!a.goal;
    case 1:
      return a.days.length > 0 && !!a.minutes;
    case 2:
      return !!a.gymType;
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

  const familiarity = useQuery(() => api.getFamiliarityOptions(), []);

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
    if (editingFromReview) {
      setEditingFromReview(false);
      setStep(REVIEW_STEP);
    } else {
      setStep(Math.min(step + 1, REVIEW_STEP));
    }
  };

  const editStep = (target: number) => {
    setEditingFromReview(true);
    setStep(target);
  };

  const submit = async () => {
    setSaving(true);
    setSaveError(undefined);
    try {
      await api.saveProfile(toProfileInput(answers));
      const job = await api.startGeneration();
      router.replace({ pathname: '/generating', params: { jobId: job.id } });
    } catch {
      setSaveError("I couldn't save your answers. Check your connection and try again.");
      setSaving(false);
    }
  };

  const onContinue = step === REVIEW_STEP ? submit : goNext;

  // --- Per-step content ------------------------------------------------------

  let echo: string | undefined;
  let heading: string;
  let helper: string;
  let body: ReactNode;
  let secondary: { label: string; onPress: () => void } | undefined;

  switch (step) {
    case 0:
      heading = 'What do you want out of training?';
      helper = 'Pick the one that matters most right now. You can change it later.';
      body = (
        <ChipRow>
          {GOALS.map((g) => (
            <Chip key={g.value} label={g.label} selected={answers.goal === g.value} onPress={() => update({ goal: g.value })} />
          ))}
        </ChipRow>
      );
      break;

    case 1:
      echo = labelOf(GOALS, answers.goal);
      heading = 'When can you train?';
      helper = "Tap the days that usually work and how long you've got each time.";
      body = (
        <>
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

    case 2:
      echo = scheduleSummary(answers);
      heading = 'Where will you train?';
      helper = "I'll only pick exercises you can do with what you have.";
      body = (
        <>
          <Group label="Gym type">
            <ChipRow>
              {GYM_TYPES.map((g) => (
                <Chip
                  key={g.value}
                  label={g.label}
                  selected={answers.gymType === g.value}
                  onPress={() =>
                    answers.gymType !== g.value && update({ gymType: g.value, equipment: EQUIPMENT_FOR_GYM[g.value] })
                  }
                />
              ))}
            </ChipRow>
          </Group>
          {answers.gymType && (
            <Group label="Equipment you can use">
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
            </Group>
          )}
        </>
      );
      break;

    case 3:
      echo = equipmentSummary(answers);
      heading = 'Which of these are you comfortable doing?';
      helper = "Tick any you can do with good form. I'll build your plan around them.";
      body = familiarity.data ? (
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

    case 4:
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
      heading = "Here's what I've got";
      helper = 'Check your answers. Tap one to change it.';
      body = (
        <View style={styles.review}>
          <ReviewRow label="Goal" value={labelOf(GOALS, answers.goal)} onPress={() => editStep(0)} />
          <ReviewRow
            label="Schedule"
            value={[
              WEEKDAYS.filter((d) => answers.days.includes(d.value))
                .map((d) => d.label)
                .join(', '),
              answers.minutes ? `${answers.minutes} min` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
            onPress={() => editStep(1)}
          />
          <ReviewRow label="Equipment" value={equipmentSummary(answers)} onPress={() => editStep(2)} />
          <ReviewRow label="Exercises you know" value={familiaritySummary(answers, familiarity.data)} onPress={() => editStep(3)} />
          <ReviewRow label="Work around" value={limitationsSummary(answers)} onPress={() => editStep(4)} last />
        </View>
      );
      break;
  }

  const continueLabel = step === REVIEW_STEP ? (saving ? 'Saving…' : 'Build my plan') : 'Continue';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <View style={styles.header}>
          {step > 0 || canGoBackFromStart ? (
            <IconButton icon="back" accessibilityLabel="Back" onPress={goBack} />
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

function ReviewRow({ label, value, onPress, last = false }: { label: string; value: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
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
