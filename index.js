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
app.use(express.static('public'));
app.use('/workout', express.static(path.join(__dirname, 'Workout')));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 hours
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
    savedAt: { type: Date, default: Date.now }
});

var Workout = mongoose.model('Workout', workoutSchema);

// Auth middleware
function requireAuth(req, res, next) {
    if (!req.session.privyUserId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
}

function requireAuthPage(req, res, next) {
    if (!req.session.privyUserId) {
        return res.redirect('/');
    }
    next();
}

// Routes
app.get('/', (req, res) => {
    if (req.session.privyUserId) return res.redirect('/home');
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/home', requireAuthPage, (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'RYR.html'));
});

// Exchange Privy access token for a server session
app.post('/auth/privy', async (req, res) => {
    var token = req.body.token;
    if (!token) return res.status(400).json({ error: 'No token provided' });

    try {
        // Verify the token by calling Privy's API
        var response = await axios.get('https://auth.privy.io/api/v1/users/me', {
            headers: {
                'Authorization': 'Bearer ' + token,
                'privy-app-id': process.env.PRIVY_APP_ID
            }
        });
        var privyUserId = response.data.id; // e.g. "did:privy:xxxx"
        req.session.privyUserId = privyUserId;
        res.json({ success: true });
    } catch (err) {
        console.error('Privy token verification failed:', err.response?.data || err.message);
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

app.listen(process.env.PORT || 3000, () => {
    console.log('Listening on PORT ' + (process.env.PORT || 3000));
});
