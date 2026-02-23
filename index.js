require('dotenv').config();
var express = require('express');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var session = require('express-session');
var axios = require('axios');
var path = require('path');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        sameSite: 'lax',
        httpOnly: true,
    }
}));

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

var db = mongoose.connection;
db.on('error', () => console.log('Error connecting to Database'));
db.once('open', () => console.log('Connected to Database'));

// User schema — stores onboarding preferences
var userSchema = new mongoose.Schema({
    privyUserId: { type: String, required: true, unique: true },
    email: String,
    fitnessLevel: String,          // 'beginner' | 'intermediate' | 'professional' | 'unsure'
    targetMuscles: [String],       // e.g. ['chest', 'biceps']
    frequency: Number,             // workouts per week
    sessionDuration: Number,       // minutes per session
    preferences: String,           // free text, optional
    onboardingComplete: { type: Boolean, default: false }
});

var User = mongoose.model('User', userSchema);

// Workout schema — keyed by Privy user DID
var workoutSchema = new mongoose.Schema({
    privyUserId: { type: String, required: true },
    exercises: [String],
    source: { type: String, default: 'manual' },
    planId: String,
    workcardId: String,
    dayLabel: String,
    completionScore: Number,
    completedCount: Number,
    totalCount: Number,
    sessionDate: String,
    sessionWeekday: String,
    savedAt: { type: Date, default: Date.now }
});

var Workout = mongoose.model('Workout', workoutSchema);

// Workout plan schema — stores reusable AI plan ideas/cards
var workoutPlanSchema = new mongoose.Schema({
    privyUserId: { type: String, required: true },
    name: { type: String, required: true },
    source: { type: String, enum: ['onboarding', 'custom'], default: 'custom' },
    fitnessLevel: String,
    targetMuscles: [String],
    frequency: Number,
    sessionDuration: Number,
    preferences: String,
    status: { type: String, enum: ['draft', 'generating', 'ready', 'failed'], default: 'draft' },
    generatedPlan: mongoose.Schema.Types.Mixed,
    lastError: String
}, { timestamps: true });

var WorkoutPlan = mongoose.model('WorkoutPlan', workoutPlanSchema);

// Workcard schema — one checklist card per generated plan day
var workcardSchema = new mongoose.Schema({
    privyUserId: { type: String, required: true },
    planId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'WorkoutPlan' },
    planName: String,
    dayIndex: Number,
    dayLabel: String,
    focus: [String],
    date: String,      // YYYY-MM-DD from the UI
    weekday: String,   // user-entered weekday label
    exercises: [{
        name: String,
        sets: Number,
        reps: String,
        restSeconds: Number,
        notes: String
    }],
    checked: [Boolean],
    completedCount: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'submitted'], default: 'pending' },
    submittedAt: Date
}, { timestamps: true });

var Workcard = mongoose.model('Workcard', workcardSchema);

// Auth middleware
function requireAuth(req, res, next) {
    if (!req.session.privyUserId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
}

function normalizeMuscles(input) {
    if (!Array.isArray(input)) return [];
    return input
        .filter(m => typeof m === 'string')
        .map(m => m.trim())
        .filter(Boolean);
}

function safeNumber(input) {
    var num = Number(input);
    return Number.isFinite(num) ? num : undefined;
}

function extractJsonObject(rawText) {
    if (!rawText || typeof rawText !== 'string') return null;
    var cleaned = rawText.trim()
        .replace(/^```json/i, '')
        .replace(/^```/, '')
        .replace(/```$/, '')
        .trim();
    var start = cleaned.indexOf('{');
    var end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    return cleaned.slice(start, end + 1);
}

function parseGeminiResponse(data) {
    var parts = data?.candidates?.[0]?.content?.parts || [];
    var text = parts.map(p => p.text || '').join('\n').trim();
    if (!text) throw new Error('Empty Gemini response');

    try {
        return JSON.parse(text);
    } catch (_err) {
        var jsonSlice = extractJsonObject(text);
        if (!jsonSlice) throw new Error('Gemini response was not valid JSON');
        return JSON.parse(jsonSlice);
    }
}

function validateGeneratedPlan(plan) {
    if (!plan || typeof plan !== 'object') throw new Error('Plan response must be an object');
    if (!Array.isArray(plan.days) || !plan.days.length) throw new Error('Plan must include at least one day');
}

function normalizeDayExercises(day) {
    var items = Array.isArray(day?.exercises) ? day.exercises : [];
    return items
        .filter(ex => ex && typeof ex.name === 'string' && ex.name.trim())
        .map(ex => ({
            name: String(ex.name).trim(),
            sets: safeNumber(ex.sets),
            reps: ex.reps ? String(ex.reps).trim() : '',
            restSeconds: safeNumber(ex.restSeconds),
            notes: ex.notes ? String(ex.notes).trim() : ''
        }));
}

function calculateCompletion(checked, totalCount) {
    var completedCount = checked.filter(Boolean).length;
    var score = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    return { completedCount, score };
}

async function generatePlanWithGemini(input) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    var model = process.env.GEMINI_MODEL || 'gemini-2.5-pro';
    var endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + process.env.GEMINI_API_KEY;

    var prompt = [
        'Create a personalized workout plan.',
        'Return JSON only (no markdown, no extra text) with this exact top-level shape:',
        '{ "title": string, "summary": string, "days": Day[], "notes": string[] }',
        'Each Day must be: { "day": string, "focus": string[], "durationMinutes": number, "exercises": Exercise[] }',
        'Each Exercise must be: { "name": string, "sets": number, "reps": string, "restSeconds": number, "notes": string }',
        'User profile:',
        JSON.stringify(input, null, 2)
    ].join('\n');

    var body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.4
        }
    };

    var response = await axios.post(endpoint, body);
    var parsed = parseGeminiResponse(response.data);
    validateGeneratedPlan(parsed);
    return parsed;
}


// Exchange Privy access token for a server session
app.post('/auth/privy', (req, res) => {
    var token = req.body.token;
    if (!token) return res.status(400).json({ error: 'No token provided' });

    try {
        // Privy access tokens are JWTs — decode the payload to get the user's DID
        var parts = token.split('.');
        if (parts.length !== 3) throw new Error('Invalid JWT format');
        var payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        var privyUserId = payload.sub; // e.g. "did:privy:xxxx"
        if (!privyUserId) throw new Error('No sub in token');

        req.session.privyUserId = privyUserId;
        req.session.save(function(err) {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Session save failed' });
            }
            res.json({ success: true });
        });
    } catch (err) {
        console.error('Token decode error:', err.message);
        res.status(401).json({ error: 'Invalid token' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

// Get user profile / onboarding status
app.get('/api/user/profile', requireAuth, async (req, res) => {
    try {
        var user = await User.findOne({ privyUserId: req.session.privyUserId });
        if (!user) {
            return res.json({ onboardingComplete: false });
        }
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Save / update user preferences (upsert)
app.post('/api/user/profile', requireAuth, async (req, res) => {
    var { email, fitnessLevel, targetMuscles, frequency, sessionDuration, preferences } = req.body;
    try {
        await User.findOneAndUpdate(
            { privyUserId: req.session.privyUserId },
            {
                privyUserId: req.session.privyUserId,
                email,
                fitnessLevel,
                targetMuscles,
                frequency,
                sessionDuration,
                preferences,
                onboardingComplete: true
            },
            { upsert: true, new: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save profile' });
    }
});

// Exercise proxy — keeps the API key on the server
app.get('/api/exercises', requireAuth, async (req, res) => {
    var type = req.query.type;
    var difficulty = req.query.difficulty;
    var muscle = req.query.muscle;

    var url = 'https://api.api-ninjas.com/v1/exercises?type=' + type + '&difficulty=' + difficulty + '&limit=20';
    if (muscle && muscle !== 'none') {
        url += '&muscle=' + muscle;
    }

    try {
        var response = await axios.get(url, {
            headers: { 'X-Api-Key': process.env.EXERCISE_API_KEY }
        });
        res.json(response.data);
    } catch (err) {
        console.error('Exercise API error:', err.message);
        res.status(500).json({ error: 'Failed to fetch exercises' });
    }
});

// Save a workout
app.post('/api/workouts', requireAuth, async (req, res) => {
    var exercises = req.body.exercises;
    if (!exercises || !exercises.length) {
        return res.status(400).json({ error: 'No exercises provided' });
    }
    try {
        var workout = new Workout({ privyUserId: req.session.privyUserId, exercises });
        await workout.save();
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save workout' });
    }
});

// Get all saved workouts for the logged-in user
app.get('/api/workouts', requireAuth, async (req, res) => {
    try {
        var workouts = await Workout.find({ privyUserId: req.session.privyUserId }).sort({ savedAt: -1 });
        res.json(workouts);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch workouts' });
    }
});

// Create a workout idea/plan card
app.post('/api/workout-plans', requireAuth, async (req, res) => {
    var body = req.body || {};
    var targetMuscles = normalizeMuscles(body.targetMuscles);
    var sessionDuration = safeNumber(body.sessionDuration);
    var frequency = safeNumber(body.frequency);

    var planDoc = {
        privyUserId: req.session.privyUserId,
        name: body.name && String(body.name).trim() ? String(body.name).trim() : 'Workout Plan',
        source: body.source === 'onboarding' ? 'onboarding' : 'custom',
        fitnessLevel: body.fitnessLevel ? String(body.fitnessLevel).trim() : '',
        targetMuscles,
        frequency,
        sessionDuration,
        preferences: body.preferences ? String(body.preferences).trim() : '',
        status: 'draft'
    };

    try {
        var plan = await WorkoutPlan.create(planDoc);
        res.json({ success: true, plan });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create workout plan' });
    }
});

// Get all workout plans/cards for logged in user
app.get('/api/workout-plans', requireAuth, async (req, res) => {
    try {
        var plans = await WorkoutPlan.find({ privyUserId: req.session.privyUserId }).sort({ updatedAt: -1 });
        res.json(plans);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch workout plans' });
    }
});

// Get single workout plan by id
app.get('/api/workout-plans/:id', requireAuth, async (req, res) => {
    try {
        var plan = await WorkoutPlan.findOne({
            _id: req.params.id,
            privyUserId: req.session.privyUserId
        });
        if (!plan) return res.status(404).json({ error: 'Workout plan not found' });
        res.json(plan);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch workout plan' });
    }
});

// Generate workout details for an existing plan card using Gemini
app.post('/api/workout-plans/:id/generate', requireAuth, async (req, res) => {
    try {
        var plan = await WorkoutPlan.findOne({
            _id: req.params.id,
            privyUserId: req.session.privyUserId
        });

        if (!plan) return res.status(404).json({ error: 'Workout plan not found' });

        plan.status = 'generating';
        plan.lastError = '';
        await plan.save();

        var generated = await generatePlanWithGemini({
            fitnessLevel: plan.fitnessLevel,
            targetMuscles: plan.targetMuscles,
            frequency: plan.frequency,
            sessionDuration: plan.sessionDuration,
            preferences: plan.preferences
        });

        plan.generatedPlan = generated;
        plan.status = 'ready';
        plan.lastError = '';
        await plan.save();

        res.json({ success: true, plan });
    } catch (err) {
        console.error(err);
        try {
            await WorkoutPlan.findOneAndUpdate(
                { _id: req.params.id, privyUserId: req.session.privyUserId },
                { status: 'failed', lastError: err.message || 'Generation failed' }
            );
        } catch (_ignored) {}

        res.status(500).json({ error: err.message || 'Failed to generate workout plan' });
    }
});

// Generate workcards for each day in a ready workout plan
app.post('/api/workout-plans/:id/workcards', requireAuth, async (req, res) => {
    try {
        var plan = await WorkoutPlan.findOne({
            _id: req.params.id,
            privyUserId: req.session.privyUserId
        });

        if (!plan) return res.status(404).json({ error: 'Workout plan not found' });
        if (plan.status !== 'ready' || !Array.isArray(plan.generatedPlan?.days)) {
            return res.status(400).json({ error: 'Generate the workout plan first' });
        }

        var existing = await Workcard.find({
            privyUserId: req.session.privyUserId,
            planId: plan._id
        }).sort({ dayIndex: 1 });
        if (existing.length) {
            return res.json({ success: true, workcards: existing, reused: true });
        }

        var docs = plan.generatedPlan.days.map((day, index) => {
            var exercises = normalizeDayExercises(day);
            return {
                privyUserId: req.session.privyUserId,
                planId: plan._id,
                planName: plan.name,
                dayIndex: index + 1,
                dayLabel: day?.day ? String(day.day) : 'Day ' + (index + 1),
                focus: Array.isArray(day?.focus) ? day.focus.filter(Boolean).map(String) : [],
                exercises,
                checked: exercises.map(() => false),
                totalCount: exercises.length,
                completedCount: 0,
                score: 0,
                status: 'pending'
            };
        });

        var workcards = await Workcard.insertMany(docs);
        res.json({ success: true, workcards });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to generate workcards' });
    }
});

// List all workcards for logged in user
app.get('/api/workcards', requireAuth, async (req, res) => {
    try {
        var filter = { privyUserId: req.session.privyUserId };
        if (req.query.status === 'pending' || req.query.status === 'submitted') {
            filter.status = req.query.status;
        }
        if (req.query.planId) {
            filter.planId = req.query.planId;
        }

        var workcards = await Workcard.find(filter).sort({ status: 1, dayIndex: 1, createdAt: -1 });
        res.json(workcards);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch workcards' });
    }
});

// Update a pending workcard (date/day/checklist progress)
app.patch('/api/workcards/:id', requireAuth, async (req, res) => {
    try {
        var workcard = await Workcard.findOne({
            _id: req.params.id,
            privyUserId: req.session.privyUserId
        });
        if (!workcard) return res.status(404).json({ error: 'Workcard not found' });
        if (workcard.status === 'submitted') return res.status(400).json({ error: 'Workcard already submitted' });

        var date = req.body.date;
        var weekday = req.body.weekday;
        var checked = req.body.checked;

        if (typeof date === 'string') workcard.date = date.trim();
        if (typeof weekday === 'string') workcard.weekday = weekday.trim();

        if (Array.isArray(checked)) {
            var normalizedChecked = checked.map(Boolean).slice(0, workcard.totalCount);
            while (normalizedChecked.length < workcard.totalCount) normalizedChecked.push(false);
            workcard.checked = normalizedChecked;
        }

        var completion = calculateCompletion(workcard.checked || [], workcard.totalCount || 0);
        workcard.completedCount = completion.completedCount;
        workcard.score = completion.score;
        await workcard.save();

        res.json({ success: true, workcard });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update workcard' });
    }
});

// Submit a workcard and write summary into workout history
app.post('/api/workcards/:id/submit', requireAuth, async (req, res) => {
    try {
        var workcard = await Workcard.findOne({
            _id: req.params.id,
            privyUserId: req.session.privyUserId
        });
        if (!workcard) return res.status(404).json({ error: 'Workcard not found' });
        if (workcard.status === 'submitted') return res.json({ success: true, workcard, alreadySubmitted: true });
        if (!workcard.date || !workcard.weekday) {
            return res.status(400).json({ error: 'Date and day are required before submit' });
        }

        var checked = Array.isArray(workcard.checked) ? workcard.checked : [];
        var completion = calculateCompletion(checked, workcard.totalCount || 0);

        workcard.completedCount = completion.completedCount;
        workcard.score = completion.score;
        workcard.status = 'submitted';
        workcard.submittedAt = new Date();
        await workcard.save();

        var completedNames = (workcard.exercises || [])
            .filter((_ex, idx) => checked[idx])
            .map(ex => ex.name);

        await Workout.create({
            privyUserId: req.session.privyUserId,
            source: 'workcard',
            planId: String(workcard.planId),
            workcardId: String(workcard._id),
            dayLabel: workcard.dayLabel,
            completionScore: workcard.score,
            completedCount: workcard.completedCount,
            totalCount: workcard.totalCount,
            sessionDate: workcard.date,
            sessionWeekday: workcard.weekday,
            exercises: completedNames.length ? completedNames : ['No exercises completed']
        });

        res.json({ success: true, workcard });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to submit workcard' });
    }
});

app.listen(process.env.PORT || 3000, () => {
    console.log('Listening on PORT ' + (process.env.PORT || 3000));
});
