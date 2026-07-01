const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('../models/User');

const router = express.Router();

// Verify Firebase ID token via REST API (no service account needed)
const verifyFirebaseToken = async (idToken) => {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_API_KEY}`;
  const response = await axios.post(url, { idToken });
  if (!response.data.users || response.data.users.length === 0) {
    throw new Error('Invalid Firebase token');
  }
  return response.data.users[0];
};

// POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: 'idToken required' });

    const firebaseUser = await verifyFirebaseToken(idToken);

    let user = await User.findOne({ firebaseUid: firebaseUser.localId });

    if (!user) {
      user = await User.create({
        firebaseUid: firebaseUser.localId,
        email: firebaseUser.email,
        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
        photoURL: firebaseUser.photoUrl || null,
      });
    } else {
      // Update name/photo if changed
      user.name = firebaseUser.displayName || user.name;
      user.photoURL = firebaseUser.photoUrl || user.photoURL;
      await user.save();
    }

    const token = jwt.sign(
      { userId: user._id, firebaseUid: user.firebaseUid },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        photoURL: user.photoURL,
        onboardingComplete: user.onboardingComplete,
        calorieTarget: user.calorieTarget,
        proteinTarget: user.proteinTarget,
        carbsTarget: user.carbsTarget,
        fatsTarget: user.fatsTarget,
        goal: user.goal,
        weight: user.weight,
        height: user.height,
        age: user.age,
        sex: user.sex,
        activityLevel: user.activityLevel,
        targetWeight: user.targetWeight,
      },
    });
  } catch (err) {
    console.error('Auth error:', err.response?.data || err.message);
    res.status(401).json({ message: 'Authentication failed' });
  }
});

module.exports = router;
