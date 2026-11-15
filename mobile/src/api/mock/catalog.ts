// Sample exercise catalog for the mock data source.
import type { ExerciseCatalogEntry } from '../schemas';

export const catalog: ExerciseCatalogEntry[] = [
  // Push
  { id: 'bench-press', name: 'Bench press', muscles: ['chest', 'triceps', 'shoulders'], muscleGroup: 'upper', equipment: ['barbell', 'bench'], difficulty: 'intermediate', movementPattern: 'push_horizontal', alternatives: ['dumbbell-bench-press', 'push-up'] },
  { id: 'dumbbell-bench-press', name: 'Dumbbell bench press', muscles: ['chest', 'triceps', 'shoulders'], muscleGroup: 'upper', equipment: ['dumbbell', 'bench'], difficulty: 'beginner', movementPattern: 'push_horizontal', alternatives: ['bench-press', 'push-up'] },
  { id: 'incline-dumbbell-press', name: 'Incline dumbbell press', muscles: ['chest', 'shoulders', 'triceps'], muscleGroup: 'upper', equipment: ['dumbbell', 'bench'], difficulty: 'intermediate', movementPattern: 'push_horizontal', alternatives: ['dumbbell-bench-press', 'push-up'] },
  { id: 'cable-fly', name: 'Cable fly', muscles: ['chest'], muscleGroup: 'upper', equipment: ['cable'], difficulty: 'intermediate', movementPattern: 'isolation', alternatives: ['pec-deck', 'dumbbell-fly', 'push-up'] },
  { id: 'pec-deck', name: 'Pec deck', muscles: ['chest'], muscleGroup: 'upper', equipment: ['machine'], difficulty: 'beginner', movementPattern: 'isolation', alternatives: ['cable-fly', 'dumbbell-fly'] },
  { id: 'dumbbell-fly', name: 'Dumbbell fly', muscles: ['chest'], muscleGroup: 'upper', equipment: ['dumbbell', 'bench'], difficulty: 'beginner', movementPattern: 'isolation', alternatives: ['cable-fly', 'pec-deck'] },
  { id: 'push-up', name: 'Push-up', muscles: ['chest', 'triceps', 'shoulders'], muscleGroup: 'upper', equipment: ['bodyweight'], difficulty: 'beginner', movementPattern: 'push_horizontal', alternatives: ['dumbbell-bench-press'] },
  { id: 'overhead-press', name: 'Overhead press', muscles: ['shoulders', 'triceps'], muscleGroup: 'upper', equipment: ['barbell'], difficulty: 'intermediate', movementPattern: 'push_vertical', alternatives: ['dumbbell-shoulder-press'] },
  { id: 'dumbbell-shoulder-press', name: 'Dumbbell shoulder press', muscles: ['shoulders', 'triceps'], muscleGroup: 'upper', equipment: ['dumbbell'], difficulty: 'beginner', movementPattern: 'push_vertical', alternatives: ['overhead-press'] },
  { id: 'lateral-raise', name: 'Lateral raise', muscles: ['shoulders'], muscleGroup: 'upper', equipment: ['dumbbell'], difficulty: 'beginner', movementPattern: 'isolation', alternatives: ['cable-lateral-raise'] },
  { id: 'cable-lateral-raise', name: 'Cable lateral raise', muscles: ['shoulders'], muscleGroup: 'upper', equipment: ['cable'], difficulty: 'intermediate', movementPattern: 'isolation', alternatives: ['lateral-raise'] },
  { id: 'overhead-triceps-extension', name: 'Overhead triceps extension', muscles: ['triceps'], muscleGroup: 'upper', equipment: ['dumbbell'], difficulty: 'beginner', movementPattern: 'isolation', alternatives: ['triceps-pushdown', 'dips'] },
  { id: 'triceps-pushdown', name: 'Triceps pushdown', muscles: ['triceps'], muscleGroup: 'upper', equipment: ['cable'], difficulty: 'beginner', movementPattern: 'isolation', alternatives: ['overhead-triceps-extension'] },
  { id: 'dips', name: 'Dips', muscles: ['triceps', 'chest'], muscleGroup: 'upper', equipment: ['bodyweight'], difficulty: 'intermediate', movementPattern: 'push_vertical', alternatives: ['bench-dips', 'triceps-pushdown'] },
  { id: 'bench-dips', name: 'Bench dips', muscles: ['triceps'], muscleGroup: 'upper', equipment: ['bench', 'bodyweight'], difficulty: 'beginner', movementPattern: 'push_vertical', alternatives: ['dips'] },

  // Pull
  { id: 'pull-up', name: 'Pull-up', muscles: ['back', 'biceps'], muscleGroup: 'upper', equipment: ['pullup_bar'], difficulty: 'intermediate', movementPattern: 'pull_vertical', alternatives: ['lat-pulldown'] },
  { id: 'lat-pulldown', name: 'Lat pulldown', muscles: ['back', 'biceps'], muscleGroup: 'upper', equipment: ['cable', 'machine'], difficulty: 'beginner', movementPattern: 'pull_vertical', alternatives: ['pull-up'] },
  { id: 'dumbbell-row', name: 'Dumbbell row', muscles: ['back', 'biceps'], muscleGroup: 'upper', equipment: ['dumbbell', 'bench'], difficulty: 'beginner', movementPattern: 'pull_horizontal', alternatives: ['cable-row', 'barbell-row'] },
  { id: 'barbell-row', name: 'Barbell row', muscles: ['back', 'biceps', 'lower_back'], muscleGroup: 'upper', equipment: ['barbell'], difficulty: 'intermediate', movementPattern: 'pull_horizontal', alternatives: ['dumbbell-row', 'cable-row'] },
  { id: 'cable-row', name: 'Cable row', muscles: ['back', 'biceps'], muscleGroup: 'upper', equipment: ['cable'], difficulty: 'beginner', movementPattern: 'pull_horizontal', alternatives: ['dumbbell-row'] },
  { id: 'face-pull', name: 'Face pull', muscles: ['shoulders', 'back'], muscleGroup: 'upper', equipment: ['cable'], difficulty: 'beginner', movementPattern: 'pull_horizontal', alternatives: ['band-pull-apart'] },
  { id: 'band-pull-apart', name: 'Band pull-apart', muscles: ['shoulders', 'back'], muscleGroup: 'upper', equipment: ['band'], difficulty: 'beginner', movementPattern: 'pull_horizontal', alternatives: ['face-pull'] },
  { id: 'biceps-curl', name: 'Biceps curl', muscles: ['biceps', 'forearms'], muscleGroup: 'upper', equipment: ['dumbbell'], difficulty: 'beginner', movementPattern: 'isolation', alternatives: ['hammer-curl'] },
  { id: 'hammer-curl', name: 'Hammer curl', muscles: ['biceps', 'forearms'], muscleGroup: 'upper', equipment: ['dumbbell'], difficulty: 'beginner', movementPattern: 'isolation', alternatives: ['biceps-curl'] },

  // Legs
  { id: 'squat', name: 'Squat', muscles: ['quads', 'glutes'], muscleGroup: 'lower', equipment: ['barbell'], difficulty: 'intermediate', movementPattern: 'squat', alternatives: ['goblet-squat', 'leg-press'] },
  { id: 'goblet-squat', name: 'Goblet squat', muscles: ['quads', 'glutes'], muscleGroup: 'lower', equipment: ['dumbbell'], difficulty: 'beginner', movementPattern: 'squat', alternatives: ['squat', 'leg-press'] },
  { id: 'leg-press', name: 'Leg press', muscles: ['quads', 'glutes'], muscleGroup: 'lower', equipment: ['machine'], difficulty: 'beginner', movementPattern: 'squat', alternatives: ['goblet-squat', 'lunges'] },
  { id: 'deadlift', name: 'Deadlift', muscles: ['hamstrings', 'glutes', 'lower_back'], muscleGroup: 'lower', equipment: ['barbell'], difficulty: 'advanced', movementPattern: 'hinge', alternatives: ['romanian-deadlift'] },
  { id: 'romanian-deadlift', name: 'Romanian deadlift', muscles: ['hamstrings', 'glutes'], muscleGroup: 'lower', equipment: ['barbell'], difficulty: 'intermediate', movementPattern: 'hinge', alternatives: ['dumbbell-romanian-deadlift'] },
  { id: 'dumbbell-romanian-deadlift', name: 'Dumbbell Romanian deadlift', muscles: ['hamstrings', 'glutes'], muscleGroup: 'lower', equipment: ['dumbbell'], difficulty: 'beginner', movementPattern: 'hinge', alternatives: ['romanian-deadlift'] },
  { id: 'lunges', name: 'Lunges', muscles: ['quads', 'glutes'], muscleGroup: 'lower', equipment: ['dumbbell'], difficulty: 'beginner', movementPattern: 'lunge', alternatives: ['goblet-squat'] },
  { id: 'leg-curl', name: 'Leg curl', muscles: ['hamstrings'], muscleGroup: 'lower', equipment: ['machine'], difficulty: 'beginner', movementPattern: 'isolation', alternatives: ['dumbbell-romanian-deadlift'] },
  { id: 'calf-raise', name: 'Calf raise', muscles: ['calves'], muscleGroup: 'lower', equipment: ['bodyweight'], difficulty: 'beginner', movementPattern: 'isolation', alternatives: [] },

  // Core
  { id: 'plank', name: 'Plank', muscles: ['abs', 'obliques'], muscleGroup: 'core', equipment: ['bodyweight'], difficulty: 'beginner', movementPattern: 'core', alternatives: ['dead-bug'] },
  { id: 'dead-bug', name: 'Dead bug', muscles: ['abs'], muscleGroup: 'core', equipment: ['bodyweight'], difficulty: 'beginner', movementPattern: 'core', alternatives: ['plank'] },
  { id: 'hanging-knee-raise', name: 'Hanging knee raise', muscles: ['abs'], muscleGroup: 'core', equipment: ['pullup_bar'], difficulty: 'intermediate', movementPattern: 'core', alternatives: ['dead-bug'] },
];

/** The onboarding "which of these do you know?" list, in display order. */
export const familiarityIds = [
  'squat',
  'bench-press',
  'lat-pulldown',
  'dumbbell-row',
  'deadlift',
  'overhead-press',
  'cable-row',
  'leg-press',
  'lunges',
  'pull-up',
];

export function findExercise(id: string): ExerciseCatalogEntry | undefined {
  return catalog.find((e) => e.id === id);
}
