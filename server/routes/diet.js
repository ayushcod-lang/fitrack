const express = require('express');
const auth = require('../middleware/auth');
const FoodLog = require('../models/FoodLog');
const { parseFood } = require('../services/gemini');
const { parseFoodWithGroq } = require('../services/groq');

const router = express.Router();

// GET /api/diet?date=YYYY-MM-DD
router.get('/', auth, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'date required' });

    const log = await FoodLog.findOne({ userId: req.user.userId, date });
    res.json(log || { date, entries: [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/diet/analyze — AI food parsing
router.post('/analyze', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length < 2) {
      return res.status(400).json({ message: 'Please describe your meal' });
    }

    let result;
    let geminiError;

    // Try Gemini First
    try {
      result = await parseFood(text.trim());
    } catch (err) {
      geminiError = err.message;
      console.error('Gemini primary failed, trying Groq fallback...', geminiError);
    }

    // Fallback to Groq if Gemini fails
    if (!result && process.env.GROQ_API_KEY) {
      try {
        result = await parseFoodWithGroq(text.trim());
        console.log('✅ Groq fallback success');
      } catch (err) {
        console.error('Groq fallback failed:', err.message);
      }
    }

    if (!result) {
      throw new Error(geminiError || 'AI analysis failed on all providers');
    }

    res.json(result);
  } catch (err) {
    console.error('Final Analysis error:', err.message);
    res.status(500).json({ 
      message: 'AI analysis failed. Please try again.',
      debug: err.message
    });
  }
});

// POST /api/diet — add food entry to log
router.post('/', auth, async (req, res) => {
  try {
    const { date, entry } = req.body;
    if (!date || !entry) return res.status(400).json({ message: 'date and entry required' });

    let log = await FoodLog.findOne({ userId: req.user.userId, date });
    if (log) {
      log.entries.push(entry);
      await log.save();
    } else {
      log = await FoodLog.create({ userId: req.user.userId, date, entries: [entry] });
    }

    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/diet/:date/entry/:entryId
router.delete('/:date/entry/:entryId', auth, async (req, res) => {
  try {
    const log = await FoodLog.findOne({ userId: req.user.userId, date: req.params.date });
    if (!log) return res.status(404).json({ message: 'Log not found' });

    log.entries = log.entries.filter(e => e._id.toString() !== req.params.entryId);
    await log.save();
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
