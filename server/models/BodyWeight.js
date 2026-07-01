const mongoose = require('mongoose');

const bodyWeightSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  weight: { type: Number, required: true }, // kg
}, { timestamps: true });

bodyWeightSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('BodyWeight', bodyWeightSchema);
