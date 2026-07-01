const mongoose = require('mongoose');

const foodEntrySchema = new mongoose.Schema({
  text: String,
  calories: { type: Number, default: 0 },
  protein: { type: Number, default: 0 },
  carbs: { type: Number, default: 0 },
  fats: { type: Number, default: 0 },
  items: [{
    name: String,
    calories: Number,
    protein: Number,
    carbs: Number,
    fats: Number,
    _id: false,
  }],
  loggedAt: { type: Date, default: Date.now },
});

const foodLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true, index: true }, // YYYY-MM-DD
  entries: [foodEntrySchema],
}, { timestamps: true });

foodLogSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('FoodLog', foodLogSchema);
