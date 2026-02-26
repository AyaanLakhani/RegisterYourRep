# RegisterYourRep

**Your AI-powered personalized workout companion.**

🔗 **Live App:** [your-deployment-link-here](#)

---

## What is RegisterYourRep?

RegisterYourRep is a web application that helps you plan, track, and improve your gym workouts using AI. Whether you're a complete beginner or an advanced lifter, the app generates a personalized workout plan tailored to your fitness level, target muscles, schedule, and equipment constraints — and then helps you track your progress day by day.

---

## Features

### 🤖 AI-Generated Workout Plans
Powered by Google Gemini, RegisterYourRep generates detailed, structured workout plans based on your profile. You provide your fitness level, the muscles you want to target, how many days a week you can train, and any preferences or equipment limitations — and the AI does the rest.

### 📋 Workcards
Each day of your generated plan becomes a **Workcard** — an interactive checklist where you log which exercises you completed. You assign a date to each workcard, check off exercises as you go, and submit it when you're done. Every submission records your completion score and gets saved to your workout history.

### 📊 Dashboard & Progress Tracking
The dashboard gives you a real-time overview of your fitness journey including your current streak, total sessions completed, weekly activity, and average completion score. An interactive calendar lets you see exactly which days you trained and how well you performed.

### 🔐 Authentication
User authentication is handled by **Privy**, supporting both Google OAuth and email-based login with a one-time code. No passwords to remember.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (Pages Router) |
| Frontend | React, CSS Modules |
| Authentication | Privy |
| Database | MongoDB via Mongoose |
| Sessions | iron-session |
| AI | Google Gemini API |
| Deployment | Vercel |

---

## How It Works

1. **Sign in** using your Google account or email.
2. Go to **Workout Ideas** and create a new plan by selecting your fitness level, target muscles, session duration, and weekly frequency.
3. Click **Generate Workout** — Gemini AI builds a full multi-day plan for you.
4. Click **Generate Workcards** to turn each day of the plan into a checklist card.
5. Head to **Workcards**, assign a date to each card, and check off exercises as you complete them.
6. **Submit** the card when you're done — your score and history are saved automatically.
7. Check your **Overview** to track streaks, scores, and progress on the calendar.

---

## Project Structure

```
ryr-pages/
├── pages/                  # Next.js pages and API routes
│   ├── _app.jsx            # Root wrapper with Privy provider
│   ├── index.jsx           # Login / home page
│   ├── dashboard.jsx       # Main dashboard
│   ├── workcards.jsx       # Workcards tracker
│   └── api/                # Backend API routes (replaces Express)
│       ├── auth/           # Privy session auth
│       ├── user/           # User profile
│       ├── workouts/       # Workout history
│       ├── workout-plans/  # AI plan management
│       └── workcards/      # Workcard CRUD and submission
├── components/             # Shared React components
├── styles/                 # CSS modules and global styles
└── lib/                    # Database, models, session, AI helpers
```
---
*Built with React, Next.js, and Google Gemini.*
