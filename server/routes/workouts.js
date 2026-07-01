const express = require('express');
const auth = require('../middleware/auth');
const Workout = require('../models/Workout');

const router = express.Router();

// GET /api/workouts/calendar?month=2026-04 — calendar heatmap data
router.get('/calendar', auth, async (req, res) => {
  try {
    const { month } = req.query; // format: YYYY-MM
    if (!month) return res.status(400).json({ message: 'month param required (YYYY-MM)' });

    const [year, m] = month.split('-').map(Number);
    const startDate = `${year}-${String(m).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(m + 1 > 12 ? 1 : m + 1).padStart(2, '0')}-01`;
    const endYear = m + 1 > 12 ? year + 1 : year;
    const endDateStr = `${endYear}-${String(m + 1 > 12 ? 1 : m + 1).padStart(2, '0')}-01`;

    const workouts = await Workout.find({
      userId: req.user.userId,
      date: { $gte: startDate, $lt: endDateStr },
    });

    const calendarData = {};
    workouts.forEach(w => {
      const volume = w.exercises.reduce((total, ex) =>
        total + ex.sets.reduce((s, set) => s + (set.weight * set.reps), 0), 0);
      const exerciseCount = w.exercises.length;
      const setCount = w.exercises.reduce((s, ex) => s + ex.sets.length, 0);
      calendarData[w.date] = {
        volume,
        exerciseCount,
        setCount,
        caloriesBurned: w.caloriesBurned || 0,
        exercises: w.exercises.map(ex => ex.name),
      };
    });

    res.json(calendarData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/workouts?date=YYYY-MM-DD  (all workouts or filtered by date)
router.get('/', auth, async (req, res) => {
  try {
    const { date, limit = 50 } = req.query;
    const query = { userId: req.user.userId };
    if (date) query.date = date;
    const workouts = await Workout.find(query).sort({ date: -1 }).limit(parseInt(limit));
    res.json(workouts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/workouts/prs — personal records per exercise
router.get('/prs', auth, async (req, res) => {
  try {
    const workouts = await Workout.find({ userId: req.user.userId });
    const prs = {}; // { exerciseName: { weight, date } }

    workouts.forEach(workout => {
      workout.exercises.forEach(ex => {
        ex.sets.forEach(set => {
          const w = set.weight || 0;
          if (!prs[ex.name] || w > prs[ex.name].weight) {
            prs[ex.name] = { weight: w, date: workout.date };
          }
        });
      });
    });

    res.json(prs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/workouts/history/:exerciseName — history for one exercise
router.get('/history/:exerciseName', auth, async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.exerciseName);
    const workouts = await Workout.find({
      userId: req.user.userId,
      'exercises.name': name,
    }).sort({ date: 1 });

    const history = workouts.map(w => {
      const ex = w.exercises.find(e => e.name === name);
      const maxWeight = Math.max(...ex.sets.map(s => s.weight || 0));
      const totalVolume = ex.sets.reduce((sum, s) => sum + (s.weight * s.reps), 0);
      return { date: w.date, maxWeight, totalVolume, sets: ex.sets };
    });

    res.json(history);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/workouts — create or update workout for a date
router.post('/', auth, async (req, res) => {
  try {
    const { date, exercises, caloriesBurned, duration, notes } = req.body;
    if (!date || !exercises) return res.status(400).json({ message: 'date and exercises required' });

    let workout = await Workout.findOne({ userId: req.user.userId, date });

    if (workout) {
      workout.exercises = exercises;
      if (caloriesBurned !== undefined) workout.caloriesBurned = caloriesBurned;
      if (duration !== undefined) workout.duration = duration;
      if (notes !== undefined) workout.notes = notes;
      await workout.save();
    } else {
      workout = await Workout.create({
        userId: req.user.userId,
        date,
        exercises,
        caloriesBurned: caloriesBurned || 0,
        duration,
        notes,
      });
    }

    res.json(workout);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/workouts/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await Workout.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    res.json({ message: 'Workout deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
