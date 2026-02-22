const { GoogleGenerativeAI } = require('@google/generative-ai');

// Validate API key exists
if (!process.env.GOOGLE_API_KEY) {
  throw new Error(
    'GOOGLE_API_KEY is not set in .env file. ' +
    'Please add your Google Generative AI API key to the .env file.'
  );
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

/**
 * Generate a personalized workout plan using Google Gemini API
 * @param {Object} userPreferences - User's fitness preferences
 * @returns {Promise<Object>} - Generated workout plan
 */
async function generateWorkoutPlan(userPreferences) {
  try {
    const {
      fitnessLevel,
      targetMuscles,
      frequency,
      sessionDuration,
      preferences,
    } = userPreferences;

    // Build the prompt for Gemini
    const prompt = `
You are a professional fitness trainer. Generate a detailed, personalized workout plan based on the following user preferences:

Fitness Level: ${fitnessLevel}
Target Muscles: ${Array.isArray(targetMuscles) ? targetMuscles.join(', ') : targetMuscles}
Workout Frequency: ${frequency} days per week
Session Duration: ${sessionDuration} minutes per session
Additional Notes: ${preferences || 'None'}

Please provide a structured weekly workout plan with:
1. Day-by-day breakdown (e.g., Monday: Chest & Triceps)
2. For each day, list 4-6 exercises with:
   - Exercise name
   - Sets x Reps (or duration)
   - Rest period
   - Notes on form/modifications
3. A brief summary of the plan
4. Recovery and nutrition tips relevant to their fitness level

Format the response as JSON with the following structure:
{
  "summary": "Brief overview of the plan",
  "weeklySchedule": [
    {
      "day": "Monday",
      "focusAreas": ["Chest", "Triceps"],
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": 3,
          "reps": "8-10",
          "restSeconds": 90,
          "notes": "Form notes and modifications"
        }
      ],
      "duration": 45
    }
  ],
  "tipsAndNotes": [{
    "category": "Nutrition",
    "tip": "Specific tip"
  }]
}
`;

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse workout plan response');
    }

    const workoutPlan = JSON.parse(jsonMatch[0]);

    return {
      success: true,
      plan: workoutPlan,
      generatedAt: new Date(),
    };
  } catch (error) {
    console.error('Error generating workout plan:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = { generateWorkoutPlan };
