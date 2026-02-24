// File contains the prompt template for generating workout plans based on user input and experience level.

function normalizeLevel(rawLevel) {
    if (!rawLevel) return "beginner";

    const s = String(rawLevel).toLowerCase();

    if (s.startsWith("beg")) return "beginner";
    if (s.startsWith("int")) return "intermediate";
    if (s.startsWith("pro") || s.startsWith("adv")) return "professional";

    return "beginner";
}

function getLevelInstructions(level) {
    switch (level) {
        case "beginner":
            return `
The user is a BEGINNER.

Guidelines:
- Focus on learning basic movement patterns.
- They are looking to target only the main muscle groups and build a habit.
- Lower volume and intensity, higher focus on form.
- Keep the number of exercises per session low (5-6) and also lower the number of sets (2-3) and reps (8-10).
- They are also mostly looking for targeting the same muscles all the days, so you have to repeat the same exercises across the week, but you can change the order and the rep scheme.
- Use mostly machines and simple dumbbell/barbell work.
- Apart from the actual workout, also include a brief cool-down and stretching routine.
- In case of Full Body workouts, you can also include only 1-2 exercises per muscle group on each day.(e.g. biceps curls, triceps pushdowns, etc.)
`;
        case "intermediate":
            return `
The user is INTERMEDIATE.

Guidelines:
- Here the user has some experience and is looking to build muscle and strength, but they are not ready for very high volume or intensity.
- They are looking for a bit more variety and structure in their workouts, but they still want to target the same muscle groups across the week.
- You can suggest them exercise that involve more free weights and compound movements, but you should still include some machines and isolation work.
- Keep the number of exercises per session moderate (6-8) and increase the sets (3-4) and reps (8-12).
- Also make sure that the total weekly volume is higher than the beginner, but not too high. 
`;
        case "professional":
            return `
The user is ADVANCED/PROFESSIONAL.

Guidelines:
- Assume the user knows the gym ettiquette, has good form, and is looking for optimal muscle growth and strength gains.
- Higher intensity and volume with focused splits on each of the muscles groups across the week.
- Suggest high variety of exercises, including advanced compound movements, free weights, machines, and isolation work.
- Increase the number of exercises per session (8-12) and sets (4-5) with a rep range of 6-12 for hypertrophy and 1-5 for strength.
- Use advanced methods like tempo, supersets, or RPE if appropriate.
- Emphasize progression, deloads, and recovery.
`;
        default:
            return "";
    }
}

function buildWorkoutPrompt(input) {
    const level = normalizeLevel(input?.experienceLevel || input?.level);
    const levelBlock = getLevelInstructions(level);

    return [
        "You are an expert strength and conditioning coach.",
        "Create a personalized workout plan for this user.",
        "Make sure to follow the preferrence and constraints of the user, but also make sure to create a plan that is effective and realistic for their experience level.",
        "If the user has no experience level, assume they are a beginner.",
        `User experience level (normalized): ${level.toUpperCase()}.`,
        levelBlock,
        "",
        "Output rules (very important):",
        "- Return JSON ONLY. No markdown, no commentary, no backticks.",
        '- Use this exact top-level shape:',
        '{ "title": string, "summary": string, "days": Day[], "notes": string[] }',
        "",
        "Day rules:",
        '- Each Day must be: { "day": string, "focus": string[], "durationMinutes": number, "exercises": Exercise[] }',
        "- `day` is a label like 'Day 1', 'Monday Push', etc.",
        "- `focus` is a list like ['Chest', 'Triceps'] or ['Full Body']. ",
        "",
        "Exercise rules:",
        '- Each Exercise must be: { "name": string, "sets": number, "reps": string, "restSeconds": number, "notes": string }',
        "- `reps` can be a range like '8-10' or a scheme like 'AMRAP in 60s'.",
        "- `notes` should explain form, tempo, or special instructions in 1–2 short sentences.",
        "",
        "General constraints:",
        "- The plan must be realistic for the given level.",
        "- Total weekly volume and frequency must match the level block above.",
        "- Make the plan understandable for a normal gym user.",
        "",
        "User profile (JSON):",
        JSON.stringify(input, null, 2)
    ].join("\n");
}

module.exports = {
    buildWorkoutPrompt,
};