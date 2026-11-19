// Answer options for the training profile: UI labels for the ProfileInput
// enums. Shared by onboarding (the questions) and Profile (the summary).
import type { Equipment, Goal, GymType, Level, TrainingHistory, Weekday } from '../../api';

export const GOALS: { value: Goal; label: string }[] = [
  { value: 'build_muscle', label: 'Build muscle' },
  { value: 'get_stronger', label: 'Get stronger' },
  { value: 'lose_fat', label: 'Lose fat' },
  { value: 'general_fitness', label: 'General fitness' },
  { value: 'endurance', label: 'Build endurance' },
];

export const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
];

export const SESSION_MINUTES = [30, 45, 60, 75, 90];

// Picking a gym type pre-ticks its preset equipment (api/level.ts) on the next
// step, where the user unticks what theirs lacks.
export const GYM_TYPES: { value: GymType; label: string; equipmentHelper: string }[] = [
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

export const EQUIPMENT: { value: Equipment; label: string }[] = [
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

export const HISTORY: { value: TrainingHistory; label: string }[] = [
  { value: 'under_6_months', label: 'Under 6 months' },
  { value: 'six_months_to_2_years', label: '6 months to 2 years' },
  { value: 'over_2_years', label: '2+ years' },
];

export const LEVELS: { value: Level; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'pro', label: 'Pro' },
];

export const LIMIT_AREAS = ['Knees', 'Lower back', 'Shoulders', 'Wrists', 'Hips', 'Neck'];

export const labelOf = <T extends string>(options: { value: T; label: string }[], value: T | undefined) =>
  options.find((o) => o.value === value)?.label ?? '';
