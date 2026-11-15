// Plain rules that turn ProgressStats into the Progress tab's labels. No AI.
import type { Muscle, MuscleBalanceEntry, MuscleGroup, SkipReason } from '../../api';

export const GROUP_LABEL: Record<MuscleGroup, string> = {
  upper: 'Upper body',
  lower: 'Lower body',
  core: 'Core',
};

/** Short names used in the coach line ("Legs and core get the least work."). */
const GROUP_SHORT: Record<MuscleGroup, string> = { upper: 'upper body', lower: 'legs', core: 'core' };

export const GROUP_MUSCLES: Record<MuscleGroup, string> = {
  upper: 'chest · back · arms',
  lower: 'legs · glutes',
  core: 'abs · lower back',
};

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  abs: 'Abs',
  obliques: 'Obliques',
  lower_back: 'Lower back',
};

export const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  no_equipment: 'no machine free',
  didnt_know: "didn't know it",
  pain: 'it hurt',
  time: 'ran out of time',
};

/** Below this share of its target, a group or muscle counts as under-trained. */
export const UNDER_TRAINED = 0.75;

export const ratio = (actual: number, target: number) => (target > 0 ? actual / target : 1);

/** Groups under 75% of their target. */
export function leastTrained(balance: MuscleBalanceEntry[]): Set<MuscleGroup> {
  return new Set(balance.filter((b) => ratio(b.actual, b.target) < UNDER_TRAINED).map((b) => b.group));
}

export function coachLine(balance: MuscleBalanceEntry[]): string {
  const least = balance
    .filter((b) => ratio(b.actual, b.target) < UNDER_TRAINED)
    .map((b) => GROUP_SHORT[b.group]);
  if (least.length === 0) return 'Your training is well balanced. Keep it up.';
  const names = least.length === 1 ? least[0] : `${least.slice(0, -1).join(', ')} and ${least[least.length - 1]}`;
  const sentence = `${names.charAt(0).toUpperCase()}${names.slice(1)}`;
  const verb = least.length === 1 && least[0] !== 'legs' ? 'gets' : 'get';
  return `${sentence} ${verb} the least work. Try to hit ${least.length === 1 ? 'it' : 'them'} more often.`;
}
