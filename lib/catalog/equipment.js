// lib/catalog/equipment.js
// Equipment ids, equipment types, and the gym-type presets (RYR-13).
// Intake (RYR-12), generation and the eval set (RYR-11) all read from here,
// so there is one list of equipment for the whole app.
//
// Bodyweight exercises need no equipment (an empty `equipment` list), so
// "bodyweight" is not an equipment id: everyone can do those.

export const EQUIPMENT = {
  dumbbells: 'Dumbbells',
  adjustable_bench: 'Bench (flat or adjustable)',
  barbell: 'Barbell and plates',
  squat_rack: 'Squat rack or power rack',
  ez_bar: 'EZ curl bar',
  trap_bar: 'Trap / hex bar',
  kettlebell: 'Kettlebells',
  resistance_bands: 'Resistance bands',
  pullup_bar: 'Pull-up bar',
  dip_station: 'Dip station',
  plyo_box: 'Plyo box or sturdy step',
  medicine_ball: 'Medicine ball',
  ab_wheel: 'Ab wheel',
  cable_machine: 'Cable machine',
  smith_machine: 'Smith machine',
  leg_press: 'Leg press',
  hack_squat: 'Hack squat machine',
  chest_press_machine: 'Chest press machine',
  shoulder_press_machine: 'Shoulder press machine',
  lat_pulldown: 'Lat pulldown machine',
  seated_row_machine: 'Seated row machine',
  pec_deck: 'Pec deck / rear delt fly machine',
  leg_extension: 'Leg extension machine',
  leg_curl: 'Leg curl machine',
  calf_raise_machine: 'Calf raise machine',
  hip_thrust_machine: 'Hip thrust / glute drive machine',
  hip_abduction_machine: 'Hip abduction machine',
  assisted_pullup_machine: 'Assisted pull-up / dip machine',
  hyperextension_bench: 'Back extension (hyperextension) bench',
}
export const EQUIPMENT_IDS = Object.keys(EQUIPMENT)

// Equipment type of an exercise, derived from its equipment. Intermediate
// plans use it to add free-weight compounds (Questions & Decisions, Nov 15).
export const EQUIPMENT_TYPES = ['machine_cable', 'barbell', 'dumbbell', 'bodyweight', 'other']

const BARBELL = new Set(['barbell', 'ez_bar', 'trap_bar'])
const MACHINE_CABLE = new Set([
  'cable_machine', 'smith_machine', 'leg_press', 'hack_squat', 'chest_press_machine',
  'shoulder_press_machine', 'lat_pulldown', 'seated_row_machine', 'pec_deck', 'leg_extension',
  'leg_curl', 'calf_raise_machine', 'hip_thrust_machine', 'hip_abduction_machine', 'assisted_pullup_machine',
])
const OTHER = new Set(['kettlebell', 'resistance_bands', 'medicine_ball', 'ab_wheel'])

export function equipmentTypeOf(equipment) {
  if (equipment.some(e => BARBELL.has(e))) return 'barbell'
  if (equipment.some(e => MACHINE_CABLE.has(e))) return 'machine_cable'
  if (equipment.includes('dumbbells')) return 'dumbbell'
  if (equipment.some(e => OTHER.has(e))) return 'other'
  return 'bodyweight' // benches, bars, boxes and the floor
}

// ---- Gym types (Questions & Decisions, "How does the coach tell beginner,
// intermediate and pro apart?") ----
export const GYM_TYPES = {
  home: 'Home',
  apartment: 'Apartment gym',
  community: 'Community center',
  commercial: 'Commercial gym',
}
export const GYM_TYPE_IDS = Object.keys(GYM_TYPES)

// What each gym type usually has. Intake pre-ticks this list and the user
// unticks what theirs lacks; generation uses the confirmed list, never the
// gym type alone.
export const GYM_PRESETS = {
  // Bodyweight, maybe dumbbells, bands and a bench.
  home: ['dumbbells', 'resistance_bands', 'adjustable_bench'],
  // Light-to-medium dumbbells, a bench, sometimes a cable or functional trainer.
  apartment: ['dumbbells', 'adjustable_bench', 'resistance_bands', 'cable_machine'],
  // Pin-loaded machines, a dumbbell rack, a cable stack, maybe a Smith machine.
  community: [
    'dumbbells', 'adjustable_bench', 'cable_machine', 'smith_machine', 'leg_press',
    'chest_press_machine', 'shoulder_press_machine', 'lat_pulldown', 'seated_row_machine',
    'pec_deck', 'leg_extension', 'leg_curl', 'hip_abduction_machine', 'assisted_pullup_machine',
    'pullup_bar', 'hyperextension_bench',
  ],
  // Everything.
  commercial: [...EQUIPMENT_IDS],
}
