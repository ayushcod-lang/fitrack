# FitNex — AI-Powered Fitness & Diet Tracker

A full-stack fitness tracking app with AI-powered diet analysis, real-time pose detection, workout logging, progress analytics, and Google Sign-In.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Recharts, React Router v6 |
| Backend | Node.js, Express, Mongoose |
| Database | MongoDB Atlas |
| Auth | Firebase (Google Sign-In) + JWT |
| AI | Google Gemini 2.0 Flash (food parsing + AI coach) |
| AI Fallback | Groq (llama-3.3-70b) for food parsing |
| Pose Tracking | TensorFlow.js + MoveNet |

## Project Structure

```
fitness-tracker/
├── render.yaml                # Render.com backend deployment config
├── vercel.json                # Vercel frontend deployment config
│
├── server/                    # Express API (deploy to Render)
│   ├── api/
│   │   └── index.js           # Entry point
│   ├── middleware/
│   │   └── auth.js            # JWT verification
│   ├── models/
│   │   ├── User.js
│   │   ├── Workout.js
│   │   ├── FoodLog.js
│   │   └── BodyWeight.js
│   ├── routes/
│   │   ├── auth.js            # Google Sign-In → JWT
│   │   ├── profile.js         # BMR/TDEE/macro calculation
│   │   ├── workouts.js        # CRUD + PR detection
│   │   ├── diet.js            # AI food parsing
│   │   ├── progress.js        # Analytics aggregation
│   │   └── coach.js           # Gemini AI personal trainer
│   ├── services/
│   │   ├── gemini.js          # Gemini food parsing
│   │   └── groq.js            # Groq fallback
│   ├── .env.example           # ← Copy this to .env and fill in values
│   └── package.json
│
└── client/                    # React (Vite) SPA (deploy to Vercel)
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx            # Router + auth guards
    │   ├── api.js             # Axios + JWT interceptor
    │   ├── firebase.js        # Firebase config
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   ├── pages/
    │   │   ├── Login, Onboarding, Dashboard
    │   │   ├── Workout, Diet, Progress, Settings
    │   └── components/
    │       ├── AICoach/       # Gemini-powered chat coach
    │       ├── PoseTracker/   # TensorFlow pose detection
    │       ├── WorkoutSession/
    │       ├── WorkoutCalendar/
    │       ├── SmartInsights/
    │       └── Streaks/
    ├── .env.example           # ← Copy this to .env and fill in values
    └── package.json
```

## Local Development

### Prerequisites
- Node.js >= 18
- MongoDB Atlas account
- Firebase project (Google Sign-In enabled)
- Google Gemini API key

### 1. Setup environment variables

```bash
# Backend
cp server/.env.example server/.env
# → Edit server/.env with your real values

# Frontend
cp client/.env.example client/.env
# → Edit client/.env with your real values
```

### 2. Start backend

```bash
cd server
npm install
npm run dev
# → Server runs on http://localhost:5000
```

### 3. Start frontend

```bash
cd client
npm install
npm run dev
# → App runs on http://localhost:5173
```

## Deployment

### Backend → Render.com

1. Push to GitHub
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your repo — Render will auto-detect `render.yaml`
4. In the Render dashboard, add all environment variables from `server/.env.example`:
   - `MONGO_URI` — MongoDB Atlas connection string
   - `JWT_SECRET` — Generate with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
   - `FIREBASE_API_KEY` — From Firebase Console
   - `GEMINI_API_KEY` — From [Google AI Studio](https://aistudio.google.com/app/apikey)
   - `GROQ_API_KEY` — Optional fallback, from [Groq Console](https://console.groq.com/keys)
   - `CLIENT_URL` — Your Vercel frontend URL (set after step below)
5. Deploy — note your Render URL (e.g. `https://fitnex-api.onrender.com`)

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → **Import Project**
2. Select your repo → set **Root Directory** to `client`
3. Framework: **Vite** (auto-detected)
4. Add environment variables:
   - `VITE_API_URL` = your Render backend URL (e.g. `https://fitnex-api.onrender.com`)
   - All `VITE_FIREBASE_*` values from `client/.env.example`
5. Deploy — note your Vercel URL

### Post-deployment

- Go back to Render → update `CLIENT_URL` to your Vercel URL
- Go to Firebase Console → Authentication → Authorized Domains → add your Vercel domain
- Go to MongoDB Atlas → Network Access → add `0.0.0.0/0` (allow all) for Render's dynamic IPs

## Environment Variables Reference

See [`server/.env.example`](server/.env.example) and [`client/.env.example`](client/.env.example) for full documentation.
