const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Mifflin-St Jeor BMR + TDEE + macro calculation
const calculateTargets = ({ weight, height, age, sex, activityLevel, goal }) => {
  // BMR
  let bmr = sex === 'male'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  // TDEE
  const multipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  const tdee = bmr * (multipliers[activityLevel] || 1.55);

  // Calorie target based on goal
  const adjustments = { fat_loss: -500, muscle_gain: 300, maintenance: 0 };
  const calorieTarget = Math.round(tdee + (adjustments[goal] || 0));

  // Macro split
  const splits = {
    fat_loss:    { p: 0.35, c: 0.35, f: 0.30 },
    muscle_gain: { p: 0.30, c: 0.45, f: 0.25 },
    maintenance: { p: 0.30, c: 0.40, f: 0.30 },
  };
  const { p, c, f } = splits[goal] || splits.maintenance;

  return {
    calorieTarget,
    proteinTarget: Math.round((calorieTarget * p) / 4),
    carbsTarget: Math.round((calorieTarget * c) / 4),
    fatsTarget: Math.round((calorieTarget * f) / 9),
  };
};

// GET /api/profile
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-__v');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/profile
router.put('/', auth, async (req, res) => {
  try {
    const { age, height, weight, sex, activityLevel, goal, targetWeight, name,
            calorieTarget, proteinTarget, carbsTarget, fatsTarget } = req.body;

    const updateData = { name };
    if (age) updateData.age = age;
    if (height) updateData.height = height;
    if (weight) updateData.weight = weight;
    if (sex) updateData.sex = sex;
    if (activityLevel) updateData.activityLevel = activityLevel;
    if (goal) updateData.goal = goal;
    if (targetWeight !== undefined) updateData.targetWeight = targetWeight;

    // Auto-calculate targets if all body data is present
    if (age && height && weight && sex && activityLevel && goal) {
      const targets = calculateTargets({ age, height, weight, sex, activityLevel, goal });
      Object.assign(updateData, targets, { onboardingComplete: true });
    }

    // Allow manual override of targets
    if (calorieTarget) updateData.calorieTarget = calorieTarget;
    if (proteinTarget) updateData.proteinTarget = proteinTarget;
    if (carbsTarget) updateData.carbsTarget = carbsTarget;
    if (fatsTarget) updateData.fatsTarget = fatsTarget;

    const user = await User.findByIdAndUpdate(req.user.userId, updateData, { new: true }).select('-__v');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
