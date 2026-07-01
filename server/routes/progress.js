const express = require('express');
const auth = require('../middleware/auth');
const Workout = require('../models/Workout');
const FoodLog = require('../models/FoodLog');
const BodyWeight = require('../models/BodyWeight');

const router = express.Router();

// GET /api/progress?days=30
router.get('/', auth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const userId = req.user.userId;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    const startDateStr = startDate.toISOString().split('T')[0];

    const [workouts, foodLogs, bodyWeights, allWorkouts] = await Promise.all([
      Workout.find({ userId, date: { $gte: startDateStr } }).sort({ date: 1 }),
      FoodLog.find({ userId, date: { $gte: startDateStr } }).sort({ date: 1 }),
      BodyWeight.find({ userId, date: { $gte: startDateStr } }).sort({ date: 1 }),
      Workout.find({ userId }).sort({ date: 1 }),
    ]);

    // Build PR history per exercise (from all workouts)
    const prHistory = {};
    allWorkouts.forEach(workout => {
      workout.exercises.forEach(ex => {
        const maxWeight = Math.max(...ex.sets.map(s => s.weight || 0));
        if (maxWeight > 0) {
          if (!prHistory[ex.name]) prHistory[ex.name] = [];
          const last = prHistory[ex.name][prHistory[ex.name].length - 1];
          if (!last || maxWeight > last.weight) {
            prHistory[ex.name].push({ date: workout.date, weight: maxWeight });
          }
        }
      });
    });

    // Volume + calories burned per workout
    const volumeHistory = workouts.map(workout => ({
      date: workout.date,
      volume: workout.exercises.reduce((total, ex) =>
        total + ex.sets.reduce((s, set) => s + (set.weight * set.reps), 0), 0),
      caloriesBurned: workout.caloriesBurned || 0,
      duration: workout.duration || 0,
    }));

    // Daily calorie & macro history
    const calorieHistory = foodLogs.map(log => ({
      date: log.date,
      calories: log.entries.reduce((s, e) => s + (e.calories || 0), 0),
      protein: log.entries.reduce((s, e) => s + (e.protein || 0), 0),
      carbs: log.entries.reduce((s, e) => s + (e.carbs || 0), 0),
      fats: log.entries.reduce((s, e) => s + (e.fats || 0), 0),
    }));

    res.json({ prHistory, volumeHistory, calorieHistory, bodyWeights });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/progress/weight — log body weight
router.post('/weight', auth, async (req, res) => {
  try {
    const { date, weight } = req.body;
    if (!date || !weight) return res.status(400).json({ message: 'date and weight required' });

    let entry = await BodyWeight.findOne({ userId: req.user.userId, date });
    if (entry) {
      entry.weight = weight;
      await entry.save();
    } else {
      entry = await BodyWeight.create({ userId: req.user.userId, date, weight });
    }
    res.json(entry);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/progress/exercises — list of all exercise names the user has logged
router.get('/exercises', auth, async (req, res) => {
  try {
    const workouts = await Workout.find({ userId: req.user.userId });
    const names = new Set();
    workouts.forEach(w => w.exercises.forEach(ex => names.add(ex.name)));
    res.json([...names].sort());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/progress/streaks — current and longest workout streak
router.get('/streaks', auth, async (req, res) => {
  try {
    const workouts = await Workout.find({ userId: req.user.userId }).sort({ date: -1 });
    const workoutDates = [...new Set(workouts.map(w => w.date))].sort().reverse();

    if (workoutDates.length === 0) {
      return res.json({ currentStreak: 0, longestStreak: 0, totalWorkouts: 0, thisWeek: 0, thisMonth: 0 });
    }

    // Current streak (consecutive days from today/yesterday backwards)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let currentStreak = 0;
    let checkDate = new Date(today);
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Start from today or yesterday
    if (workoutDates.includes(todayStr)) {
      currentStreak = 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (workoutDates.includes(yesterdayStr)) {
      currentStreak = 1;
      checkDate = new Date(yesterday);
      checkDate.setDate(checkDate.getDate() - 1);
    }

    if (currentStreak > 0) {
      while (true) {
        const dateStr = checkDate.toISOString().split('T')[0];
        if (workoutDates.includes(dateStr)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Longest streak ever
    let longestStreak = 0;
    let tempStreak = 1;
    const sortedDates = [...workoutDates].sort();
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1]);
      const curr = new Date(sortedDates[i]);
      const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    // This week / this month counts
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisWeek = workoutDates.filter(d => new Date(d) >= weekAgo).length;
    const thisMonth = workoutDates.filter(d => new Date(d) >= monthStart).length;

    res.json({
      currentStreak,
      longestStreak,
      totalWorkouts: workoutDates.length,
      thisWeek,
      thisMonth,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/progress/achievements — compute achievement badges from data
router.get('/achievements', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const [workouts, foodLogs, bodyWeights] = await Promise.all([
      Workout.find({ userId }).sort({ date: 1 }),
      FoodLog.find({ userId }),
      BodyWeight.find({ userId }),
    ]);

    const workoutDates = [...new Set(workouts.map(w => w.date))].sort();
    const totalWorkouts = workoutDates.length;

    // Compute longest streak
    let longestStreak = 0;
    let tempStreak = 1;
    for (let i = 1; i < workoutDates.length; i++) {
      const prev = new Date(workoutDates[i - 1]);
      const curr = new Date(workoutDates[i]);
      if ((curr - prev) / 86400000 === 1) { tempStreak++; }
      else { longestStreak = Math.max(longestStreak, tempStreak); tempStreak = 1; }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    // Count total PRs
    const prs = {};
    let totalPRs = 0;
    workouts.forEach(w => {
      w.exercises.forEach(ex => {
        const maxW = Math.max(...ex.sets.map(s => s.weight || 0));
        if (maxW > 0) {
          if (!prs[ex.name] || maxW > prs[ex.name]) {
            if (prs[ex.name]) totalPRs++;
            prs[ex.name] = maxW;
          }
        }
      });
    });

    // Total volume ever lifted
    const totalVolume = workouts.reduce((sum, w) =>
      sum + w.exercises.reduce((s, ex) =>
        s + ex.sets.reduce((ss, set) => ss + (set.weight * set.reps), 0), 0), 0);

    // Total meals logged
    const totalMeals = foodLogs.reduce((s, l) => s + (l.entries?.length || 0), 0);

    // Unique exercises tried
    const uniqueExercises = new Set();
    workouts.forEach(w => w.exercises.forEach(ex => uniqueExercises.add(ex.name)));

    // Define all achievements
    const achievements = [
      { id: 'first_workout', name: 'First Steps', desc: 'Complete your first workout', icon: '🏁', condition: totalWorkouts >= 1 },
      { id: 'workouts_10', name: 'Getting Serious', desc: 'Complete 10 workouts', icon: '💪', condition: totalWorkouts >= 10, progress: Math.min(totalWorkouts, 10), target: 10 },
      { id: 'workouts_50', name: 'Half Century', desc: 'Complete 50 workouts', icon: '🔥', condition: totalWorkouts >= 50, progress: Math.min(totalWorkouts, 50), target: 50 },
      { id: 'workouts_100', name: 'Century Club', desc: 'Complete 100 workouts', icon: '💯', condition: totalWorkouts >= 100, progress: Math.min(totalWorkouts, 100), target: 100 },
      { id: 'workouts_365', name: 'Year of Iron', desc: 'Complete 365 workouts', icon: '🏆', condition: totalWorkouts >= 365, progress: Math.min(totalWorkouts, 365), target: 365 },
      { id: 'streak_7', name: 'Week Warrior', desc: '7-day workout streak', icon: '⚡', condition: longestStreak >= 7, progress: Math.min(longestStreak, 7), target: 7 },
      { id: 'streak_30', name: 'Consistency King', desc: '30-day workout streak', icon: '👑', condition: longestStreak >= 30, progress: Math.min(longestStreak, 30), target: 30 },
      { id: 'streak_90', name: 'Iron Will', desc: '90-day workout streak', icon: '🔱', condition: longestStreak >= 90, progress: Math.min(longestStreak, 90), target: 90 },
      { id: 'pr_1', name: 'PR Hunter', desc: 'Set your first personal record', icon: '🎯', condition: totalPRs >= 1 },
      { id: 'pr_10', name: 'Record Breaker', desc: 'Set 10 personal records', icon: '📈', condition: totalPRs >= 10, progress: Math.min(totalPRs, 10), target: 10 },
      { id: 'pr_50', name: 'Unstoppable', desc: 'Set 50 personal records', icon: '🚀', condition: totalPRs >= 50, progress: Math.min(totalPRs, 50), target: 50 },
      { id: 'volume_10k', name: 'Ten Ton Club', desc: 'Lift 10,000 kg total volume', icon: '🏋️', condition: totalVolume >= 10000, progress: Math.min(totalVolume, 10000), target: 10000 },
      { id: 'volume_100k', name: 'Iron Mountain', desc: 'Lift 100,000 kg total volume', icon: '⛰️', condition: totalVolume >= 100000, progress: Math.min(totalVolume, 100000), target: 100000 },
      { id: 'volume_1m', name: 'Legendary Lifter', desc: 'Lift 1,000,000 kg total volume', icon: '🌟', condition: totalVolume >= 1000000, progress: Math.min(totalVolume, 1000000), target: 1000000 },
      { id: 'meals_10', name: 'Nutrition Novice', desc: 'Log 10 meals', icon: '🍎', condition: totalMeals >= 10, progress: Math.min(totalMeals, 10), target: 10 },
      { id: 'meals_100', name: 'Diet Dedicated', desc: 'Log 100 meals', icon: '🥗', condition: totalMeals >= 100, progress: Math.min(totalMeals, 100), target: 100 },
      { id: 'exercises_10', name: 'Explorer', desc: 'Try 10 different exercises', icon: '🧭', condition: uniqueExercises.size >= 10, progress: Math.min(uniqueExercises.size, 10), target: 10 },
      { id: 'exercises_25', name: 'Versatile', desc: 'Try 25 different exercises', icon: '🎨', condition: uniqueExercises.size >= 25, progress: Math.min(uniqueExercises.size, 25), target: 25 },
      { id: 'weight_logged', name: 'Scale Watcher', desc: 'Log your body weight', icon: '⚖️', condition: bodyWeights.length >= 1 },
      { id: 'weight_30', name: 'Tracking Pro', desc: 'Log body weight 30 times', icon: '📊', condition: bodyWeights.length >= 30, progress: Math.min(bodyWeights.length, 30), target: 30 },
    ];

    const unlocked = achievements.filter(a => a.condition).length;

    res.json({ achievements, unlocked, total: achievements.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
