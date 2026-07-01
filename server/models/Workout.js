const mongoose = require('mongoose');

const setSchema = new mongoose.Schema({
  weight: { type: Number, default: 0 },  // kg
  reps: { type: Number, default: 0 },
  completed: { type: Boolean, default: true },
}, { _id: false });

const exerciseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sets: [setSchema],
  notes: String,
});

const workoutSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true, index: true }, // YYYY-MM-DD
  exercises: [exerciseSchema],
  caloriesBurned: { type: Number, default: 0 },
  duration: Number, // minutes
  notes: String,
}, { timestamps: true });

workoutSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('Workout', workoutSchema);
