const express = require('express');
const router = express.Router();
const { generateWorkoutPlan } = require('../workoutGenerator');

/**
 * Authentication middleware for routes
 */
function requireAuth(req, res, next) {
  if (!req.session.privyUserId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

/**
 * POST /api/workouts/generate
 * Generate a new workout plan based on user preferences
 */
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const { userPreferences } = req.body;

    if (!userPreferences) {
      return res.status(400).json({ error: 'User preferences required' });
    }

    const result = await generateWorkoutPlan(userPreferences);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    // TODO: Save the generated plan to the database
    // const workout = new Workout({
    //   privyUserId: req.session.privyUserId,
    //   plan: result.plan,
    //   generatedAt: new Date(),
    // });
    // await workout.save();

    res.json({ success: true, plan: result.plan });
  } catch (error) {
    console.error('Error in /api/workouts/generate:', error);
    res.status(500).json({ error: 'Failed to generate workout plan' });
  }
});

/**
 * GET /api/workouts/latest
 * Get the most recently generated workout plan for the user
 */
router.get('/latest', requireAuth, async (req, res) => {
  try {
    // TODO: Fetch latest workout plan from database
    // const workout = await Workout.findOne({
    //   privyUserId: req.session.privyUserId,
    // }).sort({ generatedAt: -1 });

    // if (!workout) {
    //   return res.json({ plan: null });
    // }

    // res.json({ success: true, plan: workout.plan });
    res.json({ success: true, plan: null });
  } catch (error) {
    console.error('Error in /api/workouts/latest:', error);
    res.status(500).json({ error: 'Failed to fetch workout plan' });
  }
});

module.exports = router;
