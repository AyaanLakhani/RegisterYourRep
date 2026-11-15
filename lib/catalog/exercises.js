// lib/catalog/exercises.js
// The exercise catalog (RYR-13): hand-curated, so every entry carries the tags
// the coach needs (Questions & Decisions, Nov 15). scripts/seed-exercises.mjs
// copies it into MongoDB; lib/catalog/index.js checks it.
//
// One line per exercise:
//   x(id, name, primary, secondary, equipment, pattern, level, options)
//   - primary / secondary: muscle ids from MUSCLES in lib/validation.js, comma-separated
//   - equipment: ids from lib/catalog/equipment.js, space-separated ('' = bodyweight)
//   - level: B (beginner), I (intermediate), P (professional)
//   - options: c = common (beginners pick these first: the usual machines and
//     cables plus basic dumbbell and bodyweight moves), a = other names
//     ('|'-separated), e / h = ids of easier / harder alternatives
// Ids are stable: plans, workcards and familiarity ticks refer to them.

const LEVELS = { B: 'beginner', I: 'intermediate', P: 'professional' }
const list = s => (s ? s.split(/[\s,]+/).filter(Boolean) : [])

function x(id, name, primary, secondary, equipment, movementPattern, level, o = {}) {
  return {
    id,
    name,
    primaryMuscles: list(primary),
    secondaryMuscles: list(secondary),
    equipment: list(equipment),
    movementPattern,
    difficulty: LEVELS[level],
    common: Boolean(o.c),
    aliases: o.a ? o.a.split('|').map(s => s.trim()).filter(Boolean) : [],
    easier: list(o.e),
    harder: list(o.h),
  }
}

export const EXERCISES = [
  // ---- Chest ----
  x('machine-chest-press', 'Machine Chest Press', 'chest', 'triceps,shoulders', 'chest_press_machine', 'horizontal_push', 'B', { c: 1, a: 'chest press machine|seated chest press|chest press', h: 'db-bench-press' }),
  x('pec-deck', 'Pec Deck Fly', 'chest', 'shoulders', 'pec_deck', 'chest_fly', 'B', { c: 1, a: 'machine fly|pec fly|butterfly|machine chest fly', h: 'db-fly' }),
  x('cable-fly', 'Cable Fly', 'chest', 'shoulders', 'cable_machine', 'chest_fly', 'B', { c: 1, a: 'cable crossover|standing cable fly|cable chest fly', h: 'db-fly' }),
  x('incline-push-up', 'Incline Push-Up', 'chest', 'triceps,shoulders', '', 'horizontal_push', 'B', { c: 1, a: 'wall push-up|bench push-up', h: 'push-up' }),
  x('push-up', 'Push-Up', 'chest', 'triceps,shoulders,core', '', 'horizontal_push', 'B', { c: 1, a: 'pushup|push ups|standard push-up', e: 'incline-push-up', h: 'decline-push-up' }),
  x('band-chest-press', 'Band Chest Press', 'chest', 'triceps,shoulders', 'resistance_bands', 'horizontal_push', 'B', { a: 'resistance band chest press' }),
  x('db-bench-press', 'Dumbbell Bench Press', 'chest', 'triceps,shoulders', 'dumbbells adjustable_bench', 'horizontal_push', 'B', { c: 1, a: 'flat dumbbell press|dumbbell chest press|db bench press|flat dumbbell bench press', e: 'machine-chest-press', h: 'barbell-bench-press' }),
  x('db-incline-press', 'Incline Dumbbell Press', 'chest', 'shoulders,triceps', 'dumbbells adjustable_bench', 'horizontal_push', 'I', { a: 'incline db press|incline dumbbell bench press', e: 'db-bench-press', h: 'incline-barbell-bench-press' }),
  x('db-fly', 'Dumbbell Fly', 'chest', 'shoulders', 'dumbbells adjustable_bench', 'chest_fly', 'I', { a: 'flat dumbbell fly|dumbbell chest fly', e: 'pec-deck' }),
  x('smith-bench-press', 'Smith Machine Bench Press', 'chest', 'triceps,shoulders', 'smith_machine adjustable_bench', 'horizontal_push', 'I', { a: 'smith bench press', e: 'machine-chest-press', h: 'barbell-bench-press' }),
  x('barbell-bench-press', 'Barbell Bench Press', 'chest', 'triceps,shoulders', 'barbell adjustable_bench squat_rack', 'horizontal_push', 'I', { a: 'bench press|flat bench press|flat barbell bench press', e: 'db-bench-press', h: 'paused-bench-press' }),
  x('incline-barbell-bench-press', 'Incline Barbell Bench Press', 'chest', 'shoulders,triceps', 'barbell adjustable_bench squat_rack', 'horizontal_push', 'I', { a: 'incline bench press', e: 'db-incline-press' }),
  x('decline-push-up', 'Decline Push-Up', 'chest', 'shoulders,triceps', 'adjustable_bench', 'horizontal_push', 'I', { a: 'feet elevated push-up', e: 'push-up' }),
  x('chest-dip', 'Chest Dip', 'chest', 'triceps,shoulders', 'dip_station', 'dip', 'I', { a: 'chest dips|forward lean dip', h: 'weighted-dip' }),
  x('paused-bench-press', 'Paused Barbell Bench Press', 'chest', 'triceps,shoulders', 'barbell adjustable_bench squat_rack', 'horizontal_push', 'P', { a: 'pause bench press', e: 'barbell-bench-press' }),
  x('weighted-dip', 'Weighted Dip', 'chest', 'triceps,shoulders', 'dip_station', 'dip', 'P', { a: 'weighted dips', e: 'chest-dip' }),

  // ---- Back ----
  x('lat-pulldown', 'Lat Pulldown', 'back', 'biceps', 'lat_pulldown', 'vertical_pull', 'B', { c: 1, a: 'wide grip lat pulldown|cable lat pulldown|pulldown|lat pull down|close grip lat pulldown', h: 'pull-up' }),
  x('seated-cable-row', 'Seated Cable Row', 'back', 'biceps', 'cable_machine', 'horizontal_pull', 'B', { c: 1, a: 'cable row|seated row|low row|seated cable rows', h: 'barbell-row' }),
  x('machine-row', 'Machine Row', 'back', 'biceps', 'seated_row_machine', 'horizontal_pull', 'B', { c: 1, a: 'seated row machine|chest supported machine row|plate loaded row|machine seated row' }),
  x('assisted-pull-up', 'Assisted Pull-Up', 'back', 'biceps', 'assisted_pullup_machine', 'vertical_pull', 'B', { c: 1, a: 'assisted pullup machine|assisted chin-up|machine assisted pull-up', h: 'pull-up' }),
  x('db-row', 'One-Arm Dumbbell Row', 'back', 'biceps', 'dumbbells adjustable_bench', 'horizontal_pull', 'B', { c: 1, a: 'single arm dumbbell row|dumbbell row|db row|one arm row|single-arm dumbbell row', h: 'barbell-row' }),
  x('band-row', 'Band Row', 'back', 'biceps', 'resistance_bands', 'horizontal_pull', 'B', { a: 'resistance band row|seated band row' }),
  x('back-extension', 'Back Extension', 'back,glutes', 'hamstrings', 'hyperextension_bench', 'hinge', 'B', { c: 1, a: 'hyperextension|45 degree back extension|back extensions' }),
  x('superman', 'Superman Hold', 'back', 'glutes', '', 'hinge', 'B', { a: 'superman|supermans' }),
  x('straight-arm-pulldown', 'Straight-Arm Cable Pulldown', 'back', '', 'cable_machine', 'vertical_pull', 'I', { a: 'straight arm pulldown|cable pullover' }),
  x('inverted-row', 'Inverted Row', 'back', 'biceps', 'smith_machine', 'horizontal_pull', 'I', { a: 'bodyweight row|australian pull-up' }),
  x('pull-up', 'Pull-Up', 'back', 'biceps', 'pullup_bar', 'vertical_pull', 'I', { a: 'pullup|pull ups|wide grip pull-up', e: 'assisted-pull-up', h: 'weighted-pull-up' }),
  x('chin-up', 'Chin-Up', 'back,biceps', '', 'pullup_bar', 'vertical_pull', 'I', { a: 'chinup|chin ups', e: 'assisted-pull-up', h: 'weighted-chin-up' }),
  x('chest-supported-db-row', 'Chest-Supported Dumbbell Row', 'back', 'biceps', 'dumbbells adjustable_bench', 'horizontal_pull', 'I', { a: 'incline dumbbell row|chest supported row', e: 'db-row' }),
  x('barbell-row', 'Barbell Bent-Over Row', 'back', 'biceps,hamstrings', 'barbell', 'horizontal_pull', 'I', { a: 'bent over row|barbell row|bent-over barbell row', e: 'db-row', h: 'pendlay-row' }),
  x('pendlay-row', 'Pendlay Row', 'back', 'biceps', 'barbell', 'horizontal_pull', 'P', { e: 'barbell-row' }),
  x('weighted-pull-up', 'Weighted Pull-Up', 'back', 'biceps', 'pullup_bar', 'vertical_pull', 'P', { a: 'weighted pullup', e: 'pull-up' }),
  x('conventional-deadlift', 'Barbell Deadlift', 'back,glutes,hamstrings', 'quadriceps,core', 'barbell', 'hinge', 'I', { a: 'deadlift|conventional deadlift|deadlifts', e: 'db-rdl', h: 'deficit-deadlift' }),
  x('deficit-deadlift', 'Deficit Deadlift', 'back,glutes,hamstrings', 'quadriceps', 'barbell', 'hinge', 'P', { e: 'conventional-deadlift' }),

  // ---- Biceps ----
  x('db-curl', 'Dumbbell Curl', 'biceps', '', 'dumbbells', 'elbow_flexion', 'B', { c: 1, a: 'dumbbell bicep curl|db curl|bicep curl|bicep curls|alternating dumbbell curl|standing dumbbell curl|dumbbell biceps curl' }),
  x('hammer-curl', 'Hammer Curl', 'biceps', '', 'dumbbells', 'elbow_flexion', 'B', { c: 1, a: 'dumbbell hammer curl|hammer curls' }),
  x('cable-curl', 'Cable Curl', 'biceps', '', 'cable_machine', 'elbow_flexion', 'B', { c: 1, a: 'cable bicep curl|cable biceps curl|rope hammer curl' }),
  x('band-curl', 'Band Curl', 'biceps', '', 'resistance_bands', 'elbow_flexion', 'B', { a: 'resistance band curl' }),
  x('barbell-curl', 'Barbell Curl', 'biceps', '', 'barbell', 'elbow_flexion', 'B', { a: 'standing barbell curl|barbell bicep curl' }),
  x('ez-bar-curl', 'EZ-Bar Curl', 'biceps', '', 'ez_bar', 'elbow_flexion', 'I', { a: 'ez bar curl|ez curl' }),
  x('incline-db-curl', 'Incline Dumbbell Curl', 'biceps', '', 'dumbbells adjustable_bench', 'elbow_flexion', 'I', { a: 'incline curl', e: 'db-curl' }),
  x('preacher-curl', 'EZ-Bar Preacher Curl', 'biceps', '', 'ez_bar adjustable_bench', 'elbow_flexion', 'I', { a: 'preacher curl|preacher curls' }),
  x('spider-curl', 'Spider Curl', 'biceps', '', 'dumbbells adjustable_bench', 'elbow_flexion', 'P', { e: 'incline-db-curl' }),
  x('barbell-21s', 'Barbell 21s', 'biceps', '', 'barbell', 'elbow_flexion', 'P', { a: '21s|bicep 21s', e: 'barbell-curl' }),
  x('weighted-chin-up', 'Weighted Chin-Up', 'biceps,back', '', 'pullup_bar', 'vertical_pull', 'P', { a: 'weighted chinup', e: 'chin-up' }),

  // ---- Triceps ----
  x('cable-pushdown', 'Cable Triceps Pushdown', 'triceps', '', 'cable_machine', 'elbow_extension', 'B', { c: 1, a: 'triceps pushdown|tricep pushdown|rope pushdown|cable pushdown|rope triceps pushdown|tricep rope pushdown' }),
  x('overhead-db-extension', 'Overhead Dumbbell Triceps Extension', 'triceps', '', 'dumbbells', 'elbow_extension', 'B', { c: 1, a: 'dumbbell overhead extension|seated overhead tricep extension|overhead tricep extension|overhead triceps extension' }),
  x('db-kickback', 'Dumbbell Triceps Kickback', 'triceps', '', 'dumbbells adjustable_bench', 'elbow_extension', 'B', { c: 1, a: 'tricep kickback|triceps kickback|dumbbell kickback' }),
  x('bench-dip', 'Bench Dip', 'triceps', 'chest,shoulders', 'adjustable_bench', 'dip', 'B', { a: 'bench dips', h: 'triceps-dip' }),
  x('band-pushdown', 'Band Triceps Pushdown', 'triceps', '', 'resistance_bands', 'elbow_extension', 'B', { a: 'band pushdown|resistance band tricep pushdown' }),
  x('cable-overhead-extension', 'Cable Overhead Triceps Extension', 'triceps', '', 'cable_machine', 'elbow_extension', 'I', { a: 'overhead cable extension|rope overhead extension|overhead rope extension' }),
  x('skull-crusher', 'EZ-Bar Skull Crusher', 'triceps', '', 'ez_bar adjustable_bench', 'elbow_extension', 'I', { a: 'skull crusher|skull crushers|lying triceps extension' }),
  x('close-grip-bench-press', 'Close-Grip Bench Press', 'triceps', 'chest,shoulders', 'barbell adjustable_bench squat_rack', 'horizontal_push', 'I', { a: 'close grip bench' }),
  x('diamond-push-up', 'Diamond Push-Up', 'triceps', 'chest', '', 'horizontal_push', 'I', { a: 'close grip push-up|diamond pushups', e: 'push-up' }),
  x('triceps-dip', 'Parallel Bar Dip', 'triceps', 'chest,shoulders', 'dip_station', 'dip', 'I', { a: 'dips|tricep dips|triceps dips|dip', e: 'bench-dip', h: 'weighted-dip' }),
  x('jm-press', 'JM Press', 'triceps', '', 'barbell adjustable_bench squat_rack', 'elbow_extension', 'P', { e: 'skull-crusher' }),

  // ---- Shoulders ----
  x('machine-shoulder-press', 'Machine Shoulder Press', 'shoulders', 'triceps', 'shoulder_press_machine', 'vertical_push', 'B', { c: 1, a: 'shoulder press machine|seated machine press|machine overhead press', h: 'db-shoulder-press' }),
  x('db-shoulder-press', 'Seated Dumbbell Shoulder Press', 'shoulders', 'triceps', 'dumbbells adjustable_bench', 'vertical_push', 'B', { c: 1, a: 'dumbbell shoulder press|db shoulder press|seated db press|dumbbell overhead press|seated dumbbell press', e: 'machine-shoulder-press', h: 'barbell-ohp' }),
  x('lateral-raise', 'Dumbbell Lateral Raise', 'shoulders', '', 'dumbbells', 'shoulder_raise', 'B', { c: 1, a: 'lateral raises|side lateral raise|db lateral raise|lateral raise|side raises' }),
  x('front-raise', 'Dumbbell Front Raise', 'shoulders', '', 'dumbbells', 'shoulder_raise', 'B', { a: 'front raises|front raise' }),
  x('face-pull', 'Cable Face Pull', 'shoulders', 'back', 'cable_machine', 'rear_delt', 'B', { c: 1, a: 'face pulls|rope face pull|face pull' }),
  x('reverse-pec-deck', 'Reverse Pec Deck', 'shoulders', 'back', 'pec_deck', 'rear_delt', 'B', { c: 1, a: 'reverse fly machine|rear delt fly machine|reverse machine fly' }),
  x('band-pull-apart', 'Band Pull-Apart', 'shoulders', 'back', 'resistance_bands', 'rear_delt', 'B', { a: 'band pull apart|band pull-aparts' }),
  x('band-overhead-press', 'Band Overhead Press', 'shoulders', 'triceps', 'resistance_bands', 'vertical_push', 'B', { a: 'resistance band shoulder press' }),
  x('rear-delt-db-fly', 'Bent-Over Dumbbell Rear Delt Fly', 'shoulders', 'back', 'dumbbells', 'rear_delt', 'I', { a: 'rear delt fly|reverse dumbbell fly|bent over reverse fly', e: 'reverse-pec-deck' }),
  x('cable-lateral-raise', 'Cable Lateral Raise', 'shoulders', '', 'cable_machine', 'shoulder_raise', 'I', { a: 'single arm cable lateral raise', e: 'lateral-raise' }),
  x('arnold-press', 'Arnold Press', 'shoulders', 'triceps', 'dumbbells adjustable_bench', 'vertical_push', 'I', { e: 'db-shoulder-press' }),
  x('smith-shoulder-press', 'Smith Machine Shoulder Press', 'shoulders', 'triceps', 'smith_machine adjustable_bench', 'vertical_push', 'I', { a: 'smith overhead press' }),
  x('barbell-ohp', 'Barbell Overhead Press', 'shoulders', 'triceps,core', 'barbell squat_rack', 'vertical_push', 'I', { a: 'overhead press|military press|standing barbell press|ohp|standing overhead press', e: 'db-shoulder-press', h: 'push-press' }),
  x('pike-push-up', 'Pike Push-Up', 'shoulders', 'triceps', '', 'vertical_push', 'I', { a: 'pike pushup', h: 'handstand-push-up' }),
  x('push-press', 'Push Press', 'shoulders', 'triceps,quadriceps', 'barbell squat_rack', 'vertical_push', 'P', { e: 'barbell-ohp' }),
  x('handstand-push-up', 'Handstand Push-Up', 'shoulders', 'triceps', '', 'vertical_push', 'P', { a: 'hspu|wall handstand push-up', e: 'pike-push-up' }),

  // ---- Core ----
  x('plank', 'Plank', 'core', '', '', 'anti_extension', 'B', { c: 1, a: 'front plank|forearm plank|planks', h: 'ab-wheel' }),
  x('side-plank', 'Side Plank', 'core', '', '', 'anti_rotation', 'B', { c: 1, a: 'side planks' }),
  x('dead-bug', 'Dead Bug', 'core', '', '', 'anti_extension', 'B', { c: 1, a: 'dead bugs|deadbug' }),
  x('bird-dog', 'Bird Dog', 'core', 'back', '', 'anti_rotation', 'B', { a: 'bird dogs' }),
  x('crunch', 'Crunch', 'core', '', '', 'core_flexion', 'B', { c: 1, a: 'crunches|abdominal crunch' }),
  x('cable-crunch', 'Kneeling Cable Crunch', 'core', '', 'cable_machine', 'core_flexion', 'B', { c: 1, a: 'cable crunch|cable crunches|rope crunch' }),
  x('pallof-press', 'Pallof Press', 'core', '', 'cable_machine', 'anti_rotation', 'B', { c: 1, a: 'cable pallof press|band pallof press' }),
  x('mountain-climber', 'Mountain Climber', 'core', 'full_body', '', 'conditioning', 'B', { a: 'mountain climbers' }),
  x('hanging-knee-raise', 'Hanging Knee Raise', 'core', '', 'pullup_bar', 'core_flexion', 'I', { a: 'knee raises|hanging knee raises|captain chair knee raise', h: 'hanging-leg-raise' }),
  x('russian-twist', 'Russian Twist', 'core', '', '', 'rotation', 'I', { a: 'russian twists|weighted russian twist' }),
  x('ab-wheel', 'Ab Wheel Rollout', 'core', '', 'ab_wheel', 'anti_extension', 'I', { a: 'ab rollout|ab wheel|ab wheel rollouts', e: 'plank' }),
  x('suitcase-carry', 'Suitcase Carry', 'core', 'full_body', 'dumbbells', 'carry', 'I', { a: 'single arm farmer carry' }),
  x('hanging-leg-raise', 'Hanging Leg Raise', 'core', '', 'pullup_bar', 'core_flexion', 'P', { a: 'hanging leg raises|toes to bar', e: 'hanging-knee-raise' }),
  x('dragon-flag', 'Dragon Flag', 'core', '', 'adjustable_bench', 'anti_extension', 'P', { a: 'dragon flags' }),

  // ---- Quadriceps ----
  x('leg-press', 'Leg Press', 'quadriceps', 'glutes,hamstrings', 'leg_press', 'squat', 'B', { c: 1, a: 'seated leg press|45 degree leg press|machine leg press|leg presses', h: 'hack-squat' }),
  x('leg-extension', 'Leg Extension', 'quadriceps', '', 'leg_extension', 'knee_extension', 'B', { c: 1, a: 'leg extensions|machine leg extension|seated leg extension' }),
  x('goblet-squat', 'Goblet Squat', 'quadriceps', 'glutes,core', 'dumbbells', 'squat', 'B', { c: 1, a: 'dumbbell goblet squat|kettlebell goblet squat|goblet squats', e: 'bodyweight-squat', h: 'barbell-back-squat' }),
  x('bodyweight-squat', 'Bodyweight Squat', 'quadriceps', 'glutes', '', 'squat', 'B', { c: 1, a: 'air squat|air squats|bodyweight squats', h: 'goblet-squat' }),
  x('split-squat', 'Split Squat', 'quadriceps', 'glutes', '', 'lunge', 'B', { a: 'static lunge|dumbbell split squat|split squats', h: 'bulgarian-split-squat' }),
  x('reverse-lunge', 'Reverse Lunge', 'quadriceps', 'glutes,hamstrings', '', 'lunge', 'B', { c: 1, a: 'reverse lunges|lunges|lunge|dumbbell reverse lunge|dumbbell lunge|bodyweight lunge', h: 'walking-lunge' }),
  x('step-up', 'Step-Up', 'quadriceps', 'glutes', 'adjustable_bench', 'lunge', 'B', { a: 'step ups|dumbbell step-up|box step-up' }),
  x('smith-squat', 'Smith Machine Squat', 'quadriceps', 'glutes', 'smith_machine', 'squat', 'I', { a: 'smith squat|smith machine squats', e: 'leg-press', h: 'barbell-back-squat' }),
  x('hack-squat', 'Hack Squat', 'quadriceps', 'glutes', 'hack_squat', 'squat', 'I', { a: 'machine hack squat|hack squats', e: 'leg-press' }),
  x('bulgarian-split-squat', 'Bulgarian Split Squat', 'quadriceps', 'glutes', 'dumbbells adjustable_bench', 'lunge', 'I', { a: 'rear foot elevated split squat|bss|dumbbell bulgarian split squat|bulgarian split squats', e: 'split-squat' }),
  x('walking-lunge', 'Dumbbell Walking Lunge', 'quadriceps', 'glutes,hamstrings', 'dumbbells', 'lunge', 'I', { a: 'walking lunges|walking lunge', e: 'reverse-lunge' }),
  x('barbell-back-squat', 'Barbell Back Squat', 'quadriceps', 'glutes,hamstrings,core', 'barbell squat_rack', 'squat', 'I', { a: 'back squat|barbell squat|squat|back squats|high bar squat', e: 'goblet-squat', h: 'front-squat' }),
  x('jump-squat', 'Jump Squat', 'quadriceps', 'glutes,calves', '', 'plyometric', 'I', { a: 'squat jumps|jump squats' }),
  x('front-squat', 'Barbell Front Squat', 'quadriceps', 'glutes,core', 'barbell squat_rack', 'squat', 'P', { a: 'front squat|front squats', e: 'barbell-back-squat' }),
  x('pistol-squat', 'Pistol Squat', 'quadriceps', 'glutes,core', '', 'squat', 'P', { a: 'pistol squats|single leg squat', e: 'split-squat' }),

  // ---- Hamstrings ----
  x('seated-leg-curl', 'Seated Leg Curl', 'hamstrings', '', 'leg_curl', 'knee_flexion', 'B', { c: 1, a: 'leg curl|machine leg curl|seated hamstring curl|leg curls|hamstring curl' }),
  x('lying-leg-curl', 'Lying Leg Curl', 'hamstrings', '', 'leg_curl', 'knee_flexion', 'B', { c: 1, a: 'prone leg curl|lying hamstring curl' }),
  x('db-rdl', 'Dumbbell Romanian Deadlift', 'hamstrings', 'glutes,back', 'dumbbells', 'hinge', 'B', { c: 1, a: 'dumbbell rdl|db rdl|romanian deadlift dumbbell|dumbbell stiff leg deadlift|dumbbell romanian deadlifts', h: 'barbell-rdl' }),
  x('cable-pull-through', 'Cable Pull-Through', 'glutes,hamstrings', 'back', 'cable_machine', 'hinge', 'B', { c: 1, a: 'pull through|cable pull through' }),
  x('band-good-morning', 'Band Good Morning', 'hamstrings', 'glutes,back', 'resistance_bands', 'hinge', 'B', { a: 'resistance band good morning' }),
  x('sliding-leg-curl', 'Sliding Leg Curl', 'hamstrings', 'glutes', '', 'knee_flexion', 'I', { a: 'slider leg curl|towel leg curl' }),
  x('barbell-rdl', 'Barbell Romanian Deadlift', 'hamstrings', 'glutes,back', 'barbell', 'hinge', 'I', { a: 'romanian deadlift|rdl|barbell rdl|stiff-legged deadlift|romanian deadlifts', e: 'db-rdl', h: 'good-morning' }),
  x('single-leg-rdl', 'Single-Leg Dumbbell Romanian Deadlift', 'hamstrings', 'glutes,core', 'dumbbells', 'hinge', 'I', { a: 'single leg rdl|single-leg romanian deadlift', e: 'db-rdl' }),
  x('kettlebell-swing', 'Kettlebell Swing', 'hamstrings,glutes', 'core,back', 'kettlebell', 'hinge', 'I', { a: 'kb swing|kettlebell swings|russian kettlebell swing' }),
  x('good-morning', 'Barbell Good Morning', 'hamstrings', 'back,glutes', 'barbell squat_rack', 'hinge', 'P', { a: 'good mornings|good morning', e: 'barbell-rdl' }),
  x('nordic-curl', 'Nordic Hamstring Curl', 'hamstrings', '', '', 'knee_flexion', 'P', { a: 'nordic curl|nordics|nordic hamstring curls', e: 'sliding-leg-curl' }),

  // ---- Glutes ----
  x('glute-bridge', 'Glute Bridge', 'glutes', 'hamstrings', '', 'hip_extension', 'B', { c: 1, a: 'bridge|bodyweight glute bridge|glute bridges|hip bridge', h: 'db-hip-thrust' }),
  x('hip-thrust-machine', 'Machine Hip Thrust', 'glutes', 'hamstrings', 'hip_thrust_machine', 'hip_extension', 'B', { c: 1, a: 'glute drive|hip thrust machine' }),
  x('cable-kickback', 'Cable Glute Kickback', 'glutes', '', 'cable_machine', 'hip_extension', 'B', { c: 1, a: 'glute kickback|cable kickback|cable kickbacks' }),
  x('hip-abduction-machine', 'Hip Abduction Machine', 'glutes', '', 'hip_abduction_machine', 'abduction', 'B', { c: 1, a: 'seated hip abduction|abductor machine|hip abduction' }),
  x('band-lateral-walk', 'Banded Lateral Walk', 'glutes', '', 'resistance_bands', 'abduction', 'B', { a: 'monster walk|lateral band walk|band walks' }),
  x('single-leg-glute-bridge', 'Single-Leg Glute Bridge', 'glutes', 'hamstrings', '', 'hip_extension', 'I', { a: 'single leg bridge', e: 'glute-bridge' }),
  x('db-hip-thrust', 'Dumbbell Hip Thrust', 'glutes', 'hamstrings', 'dumbbells adjustable_bench', 'hip_extension', 'I', { a: 'dumbbell hip thrusts', e: 'glute-bridge', h: 'barbell-hip-thrust' }),
  x('barbell-hip-thrust', 'Barbell Hip Thrust', 'glutes', 'hamstrings', 'barbell adjustable_bench', 'hip_extension', 'I', { a: 'hip thrust|hip thrusts|barbell glute bridge', e: 'db-hip-thrust', h: 'b-stance-hip-thrust' }),
  x('b-stance-hip-thrust', 'B-Stance Barbell Hip Thrust', 'glutes', 'hamstrings', 'barbell adjustable_bench', 'hip_extension', 'P', { a: 'b stance hip thrust', e: 'barbell-hip-thrust' }),
  x('sumo-deadlift', 'Sumo Deadlift', 'glutes,quadriceps', 'hamstrings,back', 'barbell', 'hinge', 'P', { a: 'sumo deadlifts', e: 'conventional-deadlift' }),

  // ---- Calves ----
  x('standing-calf-raise', 'Standing Calf Raise', 'calves', '', '', 'calf_raise', 'B', { c: 1, a: 'calf raises|bodyweight calf raise|calf raise', h: 'single-leg-calf-raise' }),
  x('machine-calf-raise', 'Machine Calf Raise', 'calves', '', 'calf_raise_machine', 'calf_raise', 'B', { c: 1, a: 'standing machine calf raise|standing calf raise machine' }),
  x('seated-calf-raise', 'Seated Calf Raise', 'calves', '', 'calf_raise_machine', 'calf_raise', 'B', { c: 1, a: 'seated calf raises' }),
  x('leg-press-calf-raise', 'Leg Press Calf Raise', 'calves', '', 'leg_press', 'calf_raise', 'B', { c: 1, a: 'calf press|leg press calf press' }),
  x('db-calf-raise', 'Dumbbell Calf Raise', 'calves', '', 'dumbbells', 'calf_raise', 'B', { a: 'dumbbell calf raises' }),
  x('single-leg-calf-raise', 'Single-Leg Calf Raise', 'calves', '', '', 'calf_raise', 'I', { a: 'single leg calf raises', e: 'standing-calf-raise', h: 'deficit-calf-raise' }),
  x('smith-calf-raise', 'Smith Machine Calf Raise', 'calves', '', 'smith_machine', 'calf_raise', 'I', { a: 'smith calf raise' }),
  x('deficit-calf-raise', 'Deficit Single-Leg Calf Raise', 'calves', '', 'dumbbells plyo_box', 'calf_raise', 'P', { e: 'single-leg-calf-raise' }),
  x('pogo-jump', 'Pogo Jumps', 'calves', 'quadriceps', '', 'plyometric', 'P', { a: 'pogo hops|pogos' }),

  // ---- Full body ----
  x('farmers-carry', "Farmer's Carry", 'full_body', 'core,back', 'dumbbells', 'carry', 'B', { c: 1, a: 'farmers walk|farmer walk|farmers carry|farmer carry' }),
  x('med-ball-slam', 'Medicine Ball Slam', 'full_body', 'core,shoulders', 'medicine_ball', 'conditioning', 'B', { a: 'ball slams|medicine ball slams' }),
  x('db-squat-to-press', 'Dumbbell Squat to Press', 'full_body', 'quadriceps,shoulders', 'dumbbells', 'squat', 'B', { a: 'squat to press|squat and press' }),
  x('db-thruster', 'Dumbbell Thruster', 'full_body', 'quadriceps,shoulders', 'dumbbells', 'squat', 'I', { a: 'thrusters|dumbbell thrusters', e: 'db-squat-to-press', h: 'barbell-thruster' }),
  x('burpee', 'Burpee', 'full_body', 'chest,quadriceps', '', 'conditioning', 'I', { a: 'burpees' }),
  x('kb-clean-and-press', 'Kettlebell Clean and Press', 'full_body', 'shoulders,glutes', 'kettlebell', 'olympic', 'I', { a: 'kettlebell clean & press' }),
  x('trap-bar-deadlift', 'Trap Bar Deadlift', 'full_body', 'quadriceps,glutes,hamstrings,back', 'trap_bar', 'hinge', 'I', { a: 'hex bar deadlift|trap bar deadlifts', h: 'conventional-deadlift' }),
  x('box-jump', 'Box Jump', 'full_body', 'quadriceps,glutes,calves', 'plyo_box', 'plyometric', 'I', { a: 'box jumps' }),
  x('power-clean', 'Power Clean', 'full_body', 'back,quadriceps,glutes', 'barbell', 'olympic', 'P', { a: 'clean|power cleans|hang power clean' }),
  x('barbell-thruster', 'Barbell Thruster', 'full_body', 'quadriceps,shoulders', 'barbell squat_rack', 'squat', 'P', { a: 'barbell thrusters', e: 'db-thruster' }),
  x('turkish-get-up', 'Turkish Get-Up', 'full_body', 'core,shoulders', 'kettlebell', 'carry', 'P', { a: 'turkish getup|tgu' }),
]

// Exercises the intake asks about ("tick the ones you're comfortable doing",
// RYR-12). A tick lets the coach use that exercise even above the user's level.
export const FAMILIARITY_EXERCISE_IDS = [
  'goblet-squat', 'leg-press', 'lat-pulldown', 'seated-cable-row', 'db-bench-press',
  'db-shoulder-press', 'db-rdl', 'push-up', 'barbell-back-squat', 'conventional-deadlift',
  'barbell-bench-press', 'barbell-ohp', 'barbell-row', 'barbell-rdl', 'pull-up',
  'barbell-hip-thrust', 'bulgarian-split-squat', 'triceps-dip', 'front-squat', 'power-clean',
]
