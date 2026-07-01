import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { StreakWidget, AchievementsBadges } from '../components/Streaks/Streaks';
import SmartInsights from '../components/SmartInsights/SmartInsights';
import './Dashboard.css';

const today = () => new Date().toISOString().split('T')[0];

const Dashboard = () => {
  const { user } = useAuth();
  const [workout, setWorkout] = useState(null);
  const [foodLog, setFoodLog] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchToday = async () => {
      try {
        const [wRes, fRes] = await Promise.all([
          api.get('/api/workouts', { params: { date: today() } }),
          api.get('/api/diet', { params: { date: today() } }),
        ]);
        setWorkout(wRes.data?.[0] || null);
        setFoodLog(fRes.data);
      } catch (err) { console.error('Dashboard fetch error:', err); }
      finally { setLoading(false); }
    };
    fetchToday();
  }, []);

  const calorieTarget = user?.calorieTarget || 2000;
  const proteinTarget = user?.proteinTarget || 150;
  const carbsTarget = user?.carbsTarget || 200;
  const fatsTarget = user?.fatsTarget || 60;

  const foodEntries = foodLog?.entries || [];
  const caloriesConsumed = foodEntries.reduce((s, e) => s + (e.calories || 0), 0);
  const proteinConsumed = foodEntries.reduce((s, e) => s + (e.protein || 0), 0);
  const carbsConsumed = foodEntries.reduce((s, e) => s + (e.carbs || 0), 0);
  const fatsConsumed = foodEntries.reduce((s, e) => s + (e.fats || 0), 0);

  const caloriesBurned = workout?.caloriesBurned || 0;
  const netCalories = caloriesConsumed - caloriesBurned;
  const remaining = calorieTarget - caloriesConsumed;
  const caloriePercent = Math.min(Math.round((caloriesConsumed / calorieTarget) * 100), 100);

  const exerciseCount = workout?.exercises?.length || 0;
  const totalVolume = workout?.exercises?.reduce((total, ex) => total + ex.sets.reduce((s, set) => s + (set.weight * set.reps), 0), 0) || 0;
  const totalSets = workout?.exercises?.reduce((total, ex) => total + ex.sets.length, 0) || 0;

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (caloriePercent / 100) * circumference;

  if (loading) return <div className="page-content"><div className="spinner" style={{ margin: '100px auto' }} /></div>;

  return (
    <div className="page-content">
      <div className="dashboard-greeting">
        <h1 className="page-title">
          {new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening'}, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="page-subtitle">Here's your fitness snapshot for today</p>
      </div>
      <StreakWidget />
      <AchievementsBadges />
      <div className="dashboard-grid">
        <div className="card dashboard-calorie-card">
          <div className="calorie-ring-wrapper">
            <svg className="calorie-ring" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r={radius} fill="none" stroke="var(--bg-glass)" strokeWidth="12" />
              <circle cx="100" cy="100" r={radius} fill="none" stroke="url(#calorieGrad)" strokeWidth="12" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference - strokeDash} transform="rotate(-90 100 100)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
              <defs><linearGradient id="calorieGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="var(--accent)" /><stop offset="100%" stopColor="var(--accent-secondary)" /></linearGradient></defs>
            </svg>
            <div className="calorie-ring-center">
              <span className="calorie-ring-value">{caloriesConsumed}</span>
              <span className="calorie-ring-label">of {calorieTarget} kcal</span>
            </div>
          </div>
          <div className="calorie-stats">
            <div className="calorie-stat"><span className="calorie-stat-label">Consumed</span><span className="calorie-stat-value eaten">{caloriesConsumed}</span></div>
            <div className="calorie-stat"><span className="calorie-stat-label">Burned</span><span className="calorie-stat-value burned">{caloriesBurned}</span></div>
            <div className="calorie-stat"><span className="calorie-stat-label">Remaining</span><span className={`calorie-stat-value ${remaining < 0 ? 'over' : 'remaining'}`}>{remaining}</span></div>
          </div>
        </div>
        <div className="card dashboard-macros-card">
          <h3 className="card-title">Macronutrients</h3>
          <div className="macros-list">
            {[{ name: 'Protein', consumed: proteinConsumed, target: proteinTarget, color: 'var(--protein)', unit: 'g' },
              { name: 'Carbs', consumed: carbsConsumed, target: carbsTarget, color: 'var(--carbs)', unit: 'g' },
              { name: 'Fats', consumed: fatsConsumed, target: fatsTarget, color: 'var(--fats)', unit: 'g' },
            ].map(macro => (
              <div key={macro.name} className="macro-row">
                <div className="macro-header">
                  <div className="macro-dot" style={{ background: macro.color }} />
                  <span className="macro-name">{macro.name}</span>
                  <span className="macro-values">{macro.consumed} / {macro.target}{macro.unit}</span>
                </div>
                <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${Math.min((macro.consumed / macro.target) * 100, 100)}%`, background: `linear-gradient(90deg, ${macro.color}, ${macro.color}dd)` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card dashboard-workout-card">
          <h3 className="card-title">Today's Workout</h3>
          {exerciseCount > 0 ? (
            <>
              <div className="workout-quick-stats">
                <div className="quick-stat"><span className="quick-stat-value">{exerciseCount}</span><span className="quick-stat-label">Exercises</span></div>
                <div className="quick-stat"><span className="quick-stat-value">{totalSets}</span><span className="quick-stat-label">Total Sets</span></div>
                <div className="quick-stat"><span className="quick-stat-value">{totalVolume.toLocaleString()}</span><span className="quick-stat-label">Volume (kg)</span></div>
              </div>
              <div className="workout-exercise-list">
                {workout.exercises.slice(0, 4).map((ex, i) => (
                  <div key={i} className="workout-exercise-item"><span className="exercise-name">{ex.name}</span><span className="exercise-sets">{ex.sets.length} sets</span></div>
                ))}
                {workout.exercises.length > 4 && <span className="exercise-more">+{workout.exercises.length - 4} more</span>}
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <p>No workout logged today</p>
              <a href="/workout" className="btn btn-secondary" style={{ textDecoration: 'none' }}>Start Workout</a>
            </div>
          )}
        </div>
        <SmartInsights />
      </div>
    </div>
  );
};

export default Dashboard;
