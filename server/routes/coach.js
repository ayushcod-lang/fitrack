const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Workout = require('../models/Workout');
const FoodLog = require('../models/FoodLog');
const User = require('../models/User');

// Gemini client (lazy init)
let genAI = null;
const getGenAI = () => {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
};

// Retry helper for Gemini rate limits
const callWithRetry = async (fn, maxRetries = 3) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimit = err.message?.includes('429') || err.message?.includes('quota');
      if (isRateLimit && attempt < maxRetries - 1) {
        const wait = (attempt + 1) * 5000; // 5s, 10s, 15s
        console.log(`[Coach] Rate limited, retrying in ${wait/1000}s (attempt ${attempt + 2}/${maxRetries})`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
};

// Helper: gather user context for AI
const gatherUserContext = async (userId) => {
  const [user, allWorkouts, recentDiet] = await Promise.all([
    User.findOne({ firebaseUid: userId }).lean(),
    Workout.find({ userId }).sort({ date: -1 }).lean(),
    FoodLog.find({ userId }).sort({ date: -1 }).limit(7).lean(),
  ]);

  const recentWorkouts = allWorkouts.slice(0, 10);
  const totalWorkouts = allWorkouts.length;
  
  // Compute PRs from all workouts
  const prs = {};

  allWorkouts.forEach(w => {
    w.exercises?.forEach(ex => {
      const maxWeight = Math.max(...ex.sets.map(s => s.weight || 0));
      if (!prs[ex.name] || maxWeight > prs[ex.name]) {
        prs[ex.name] = maxWeight;
      }
    });
  });

  // Compute streaks
  const workoutDates = [...new Set(allWorkouts.map(w =>
    new Date(w.date).toISOString().split('T')[0]
  ))].sort().reverse();

  let currentStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let i = 0; i < workoutDates.length; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const checkStr = checkDate.toISOString().split('T')[0];
    if (workoutDates.includes(checkStr)) {
      currentStreak++;
    } else if (i === 0) {
      continue; // Today might not have a workout yet
    } else {
      break;
    }
  }

  return {
    profile: {
      name: user?.name || 'User',
      goal: user?.goal || 'general_fitness',
      weight: user?.weight,
      height: user?.height,
      age: user?.age,
      calorieTarget: user?.calorieTarget || 2000,
      proteinTarget: user?.proteinTarget || 150,
    },
    stats: {
      totalWorkouts,
      currentStreak,
      personalRecords: prs,
    },
    recentWorkouts: recentWorkouts.map(w => ({
      date: w.date,
      exercises: w.exercises?.map(ex => ({
        name: ex.name,
        sets: ex.sets,
        volume: ex.sets.reduce((s, set) => s + (set.weight * set.reps), 0),
      })),
      caloriesBurned: w.caloriesBurned,
    })),
    recentDiet: recentDiet.map(d => ({
      date: d.date,
      totalCalories: d.entries?.reduce((s, e) => s + (e.calories || 0), 0),
      totalProtein: d.entries?.reduce((s, e) => s + (e.protein || 0), 0),
      totalCarbs: d.entries?.reduce((s, e) => s + (e.carbs || 0), 0),
      totalFats: d.entries?.reduce((s, e) => s + (e.fats || 0), 0),
      entryCount: d.entries?.length || 0,
    })),
  };
};

//  POST /api/coach/chat — Conversational AI Personal Trainer
router.post('/chat', auth, async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    // Gather full user context
    const context = await gatherUserContext(req.user.userId);

    const systemPrompt = `You are FitNex Coach — an elite AI personal trainer embedded in the FitNex fitness app. You have deep knowledge of exercise science, nutrition, and periodization.

CRITICAL: You have REAL DATA about this user. Use it in every response to give personalized, data-backed advice. Never give generic advice when you have specific data.

USER PROFILE:
- Name: ${context.profile.name}
- Goal: ${context.profile.goal.replace('_', ' ')}
- Weight: ${context.profile.weight || 'not set'}kg | Height: ${context.profile.height || 'not set'}cm | Age: ${context.profile.age || 'not set'}
- Daily Targets: ${context.profile.calorieTarget} kcal, ${context.profile.proteinTarget}g protein

USER STATS:
- Total workouts logged: ${context.stats.totalWorkouts}
- Current streak: ${context.stats.currentStreak} days
- Personal Records: ${JSON.stringify(context.stats.personalRecords)}

LAST 10 WORKOUTS:
${context.recentWorkouts.map(w => 
  `${w.date}: ${w.exercises?.map(e => `${e.name} (${e.sets.length} sets, ${e.volume}kg vol)`).join(', ')} | ${w.caloriesBurned || 0} kcal burned`
).join('\n')}

LAST 7 DAYS NUTRITION:
${context.recentDiet.map(d =>
  `${d.date}: ${d.totalCalories} kcal, ${d.totalProtein}g protein, ${d.totalCarbs}g carbs, ${d.totalFats}g fats (${d.entryCount} meals)`
).join('\n')}

BEHAVIOR RULES:
1. Be conversational, motivating, and concise. Use emojis sparingly.
2. When asked about progress, reference SPECIFIC data (dates, weights, volumes).
3. When recommending changes, explain WHY based on their data.
4. For exercise questions, give form cues and common mistakes.
5. For nutrition questions, compare their intake to their targets.
6. If asked to generate a workout plan, structure it clearly with sets × reps × weight.
7. Keep responses under 300 words unless the user asks for detailed analysis.
8. If you don't have enough data to answer confidently, say so honestly.`;

    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Build conversation for Gemini
    const contents = [];

    // Add conversation history
    for (const msg of conversationHistory.slice(-10)) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    // Add the new user message
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const result = await callWithRetry(async () => {
      return await model.generateContent({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          topP: 0.9,
        },
      });
    });

    const response = result.response;
    const text = response.text();

    res.json({
      reply: text,
      context: {
        totalWorkouts: context.stats.totalWorkouts,
        currentStreak: context.stats.currentStreak,
      },
    });
  } catch (err) {
    console.error('[Coach Chat Error]:', err.message);
    res.status(500).json({ error: 'Failed to get AI response', details: err.message });
  }
});

//  GET /api/coach/insights — Smart Weekly Insights
router.get('/insights', auth, async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const context = await gatherUserContext(req.user.userId);

    if (context.stats.totalWorkouts < 2) {
      return res.json({
        insights: [{
          icon: '📊',
          title: 'Getting Started',
          text: 'Log at least 2 workouts to unlock AI-powered insights about your training patterns.',
          type: 'info',
        }],
      });
    }

    // Compute muscle group frequency from recent workouts
    const muscleFreq = {};
    const volumeByExercise = {};
    const weeklyVolume = [];

    context.recentWorkouts.forEach(w => {
      let dayVol = 0;
      w.exercises?.forEach(ex => {
        const name = ex.name.toLowerCase();
        // Simple muscle group mapping
        const group =
          name.includes('squat') || name.includes('leg') || name.includes('calf') ? 'Legs' :
          name.includes('bench') || name.includes('chest') || name.includes('fly') ? 'Chest' :
          name.includes('row') || name.includes('pull') || name.includes('lat') || name.includes('deadlift') ? 'Back' :
          name.includes('shoulder') || name.includes('press') || name.includes('lateral') ? 'Shoulders' :
          name.includes('curl') || name.includes('bicep') ? 'Biceps' :
          name.includes('tricep') || name.includes('pushdown') ? 'Triceps' :
          'Other';
        muscleFreq[group] = (muscleFreq[group] || 0) + 1;
        volumeByExercise[ex.name] = (volumeByExercise[ex.name] || 0) + ex.volume;
        dayVol += ex.volume;
      });
      weeklyVolume.push({ date: w.date, volume: dayVol });
    });

    const insightPrompt = `You are an elite sports data analyst. Analyze this athlete's data and generate EXACTLY 4 actionable insights.

USER PROFILE:
- Goal: ${context.profile.goal}
- Daily Targets: ${context.profile.calorieTarget} kcal, ${context.profile.proteinTarget}g protein

TRAINING DATA (last 10 sessions):
${context.recentWorkouts.map(w =>
  `${w.date}: ${w.exercises?.map(e => `${e.name} (${e.sets.length}×, ${e.volume}kg)`).join(', ')}`
).join('\n')}

MUSCLE GROUP FREQUENCY: ${JSON.stringify(muscleFreq)}
VOLUME BY EXERCISE: ${JSON.stringify(volumeByExercise)}
PERSONAL RECORDS: ${JSON.stringify(context.stats.personalRecords)}

NUTRITION (last 7 days):
${context.recentDiet.map(d =>
  `${d.date}: ${d.totalCalories}kcal, ${d.totalProtein}g protein`
).join('\n')}

Current streak: ${context.stats.currentStreak} days
Total workouts: ${context.stats.totalWorkouts}

Generate EXACTLY 4 insights as a JSON array. Each insight must have:
- "icon": a single emoji
- "title": max 5 words
- "text": 1-2 sentences, specific and data-backed
- "type": one of "success", "warning", "tip", "info"

Focus on: progressive overload trends, muscle imbalances, nutrition gaps, consistency patterns.
Respond with ONLY the JSON array, no other text.`;

    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await callWithRetry(async () => {
      return await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: insightPrompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024,
        },
      });
    });

    const text = result.response.text();

    // Parse JSON from response (handle markdown code blocks)
    let insights;
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      insights = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (parseErr) {
      console.error('[Insights Parse Error]:', parseErr.message);
      insights = [{
        icon: '📊',
        title: 'Analysis Available',
        text: 'Your training data has been analyzed. Check back for personalized insights.',
        type: 'info',
      }];
    }

    res.json({ insights, generatedAt: new Date() });
  } catch (err) {
    console.error('[Coach Insights Error]:', err.message);
    res.status(500).json({ error: 'Failed to generate insights', details: err.message });
  }
});

module.exports = router;
