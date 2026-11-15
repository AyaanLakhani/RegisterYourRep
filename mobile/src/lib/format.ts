// Small display helpers shared by screens (no data here, only formatting).
import type { Muscle, Weekday } from '../api';

export const WEEKDAY_ORDER: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

export const WEEKDAY_LETTER: Record<Weekday, string> = {
  mon: 'M',
  tue: 'T',
  wed: 'W',
  thu: 'T',
  fri: 'F',
  sat: 'S',
  sun: 'S',
};

const LEG_MUSCLES: readonly Muscle[] = ['quads', 'hamstrings', 'glutes', 'calves'];
const CORE_MUSCLES: readonly Muscle[] = ['abs', 'obliques', 'lower_back'];

/**
 * Turns a session's focus muscles into a short list of plain-language groups,
 * e.g. Upper → ["chest", "back", "arms"], Push → ["chest", "triceps"].
 * Leg muscles collapse to "legs", core to "abs", biceps + triceps to "arms".
 * Shoulders are dropped when two or more other groups are already listed.
 */
export function muscleGroups(focus: readonly Muscle[]): string[] {
  const has = (m: Muscle) => focus.includes(m);
  const out: string[] = [];
  if (has('chest')) out.push('chest');
  if (has('back')) out.push('back');
  if (has('biceps') && has('triceps')) out.push('arms');
  else {
    if (has('biceps')) out.push('biceps');
    if (has('triceps')) out.push('triceps');
  }
  if (has('forearms') && !out.includes('arms')) out.push('forearms');
  if (LEG_MUSCLES.some(has)) out.push('legs');
  if (CORE_MUSCLES.some(has)) out.push('abs');
  if (has('shoulders') && out.length < 2) out.push('shoulders');
  return out;
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** "Chest, back, arms" */
export function formatMuscles(focus: readonly Muscle[]): string {
  return capitalize(muscleGroups(focus).join(', '));
}

/** "Chest & triceps" for two groups, "Chest, back & arms" for more. */
export function formatMusclesAnd(focus: readonly Muscle[]): string {
  const groups = muscleGroups(focus);
  if (groups.length <= 1) return capitalize(groups[0] ?? '');
  return capitalize(`${groups.slice(0, -1).join(', ')} & ${groups[groups.length - 1]}`);
}
