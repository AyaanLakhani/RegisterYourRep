// Gym-type presets, equipment filtering and the suggested-level rule.
//
// Source: Questions & Decisions, "How does the coach tell beginner,
// intermediate and pro apart?" (decided 2026-11-15). These are rules, so they
// live in code. The server should apply the same ones when it builds a plan.
import type { Equipment, ExerciseCatalogEntry, GymType, Level, TrainingHistory } from './schemas';

/** Equipment each gym type usually has. The user unticks whatever theirs lacks. */
export const GYM_TYPE_PRESETS: Record<GymType, Equipment[]> = {
  // Most things are missing at home, so start nearly empty and ask what they own.
  home: ['bodyweight'],
  // Light-to-medium dumbbells and a bench. Sometimes a cable, so not pre-ticked.
  apartment_gym: ['dumbbell', 'bench', 'bodyweight'],
  // Pin-loaded machines, dumbbell rack and a cable stack. Maybe a Smith machine.
  community_center: ['machine', 'dumbbell', 'cable', 'bench', 'bodyweight'],
  // Everything.
  commercial_gym: [
    'barbell',
    'dumbbell',
    'bench',
    'cable',
    'machine',
    'smith_machine',
    'pullup_bar',
    'kettlebell',
    'band',
    'bodyweight',
  ],
};

/** An exercise is possible when every piece of kit it needs is on the list. Bodyweight is always possible. */
export function canDoWith(exercise: Pick<ExerciseCatalogEntry, 'equipment'>, equipment: readonly Equipment[]): boolean {
  return exercise.equipment.every((e) => e === 'bodyweight' || equipment.includes(e));
}

/**
 * Suggested starting level from training history and how many exercises
 * the user ticked as familiar. The user confirms or changes it.
 *
 * - under 6 months: beginner (intermediate if they already know 6+ of the lifts)
 * - 6 months to 2 years: intermediate (beginner if they know fewer than 2)
 * - over 2 years: pro if they know 6+, otherwise intermediate
 */
export function suggestLevel(history: TrainingHistory, familiarCount: number): Level {
  switch (history) {
    case 'under_6_months':
      return familiarCount >= 6 ? 'intermediate' : 'beginner';
    case 'six_months_to_2_years':
      return familiarCount < 2 ? 'beginner' : 'intermediate';
    case 'over_2_years':
      return familiarCount >= 6 ? 'pro' : 'intermediate';
  }
}
