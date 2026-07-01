const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  name: String,
  photoURL: String,
  // Onboarding profile
  age: Number,
  height: Number,       // cm
  weight: Number,       // kg
  sex: { type: String, enum: ['male', 'female'] },
  activityLevel: { type: String, enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'] },
  goal: { type: String, enum: ['fat_loss', 'muscle_gain', 'maintenance'] },
  targetWeight: Number,
  // Calculated targets
  calorieTarget: Number,
  proteinTarget: Number,  // grams
  carbsTarget: Number,    // grams
  fatsTarget: Number,     // grams
  onboardingComplete: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
