require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('../routes/auth');
const profileRoutes = require('../routes/profile');
const workoutRoutes = require('../routes/workouts');
const dietRoutes = require('../routes/diet');
const progressRoutes = require('../routes/progress');
const coachRoutes = require('../routes/coach');

const app = express();

const allowedOrigins = (process.env.CLIENT_URL || '*').split(',');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Security headers
app.use(helmet());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', apiLimiter);

app.use(express.json({ limit: '10mb' }));

// Serverless MongoDB Connection Middleware
app.use(async (req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    return next();
  }
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ MongoDB connected');
    next();
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    res.status(500).json({ message: 'Database connection failed', error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date(), dbState: mongoose.connection.readyState }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/diet', dietRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/coach', coachRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

module.exports = app;
