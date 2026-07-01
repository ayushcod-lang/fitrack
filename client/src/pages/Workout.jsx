import { useState, useEffect } from 'react';
import api from '../api';
import WorkoutSession from '../components/WorkoutSession/WorkoutSession';
import WorkoutCalendar from '../components/WorkoutCalendar/WorkoutCalendar';
import './Workout.css';

const today = () => new Date().toISOString().split('T')[0];

const COMMON_EXERCISES = [
  'Barbell Squat', 'Bench Press', 'Deadlift', 'Overhead Press', 'Barbell Row', 'Pull-ups',
  'Dumbbell Curl', 'Lateral Raise', 'Leg Press', 'Romanian Deadlift', 'Incline Bench Press',
  'Cable Fly', 'Tricep Pushdown', 'Leg Curl', 'Calf Raise', 'Dumbbell Shoulder Press',
];

const Workout = () => {
  const [date, setDate] = useState(today());
  const [exercises, setExercises] = useState([]);
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [newExercise, setNewExercise] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [prs, setPrs] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [prAlert, setPrAlert] = useState(null);
  const [sessionMode, setSessionMode] = useState(false);
  const [workoutTab, setWorkoutTab] = useState('log'); // 'log' | 'history'

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [wRes, prRes] = await Promise.all([api.get('/api/workouts', { params: { date } }), api.get('/api/workouts/prs')]);
        const w = wRes.data?.[0];
        if (w) { setExercises(w.exercises); setCaloriesBurned(w.caloriesBurned || 0); }
        else { setExercises([]); setCaloriesBurned(0); }
        setPrs(prRes.data || {});
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
  }, [date]);

  const save = async (updatedExercises, updatedCals) => {
    setSaving(true);
    try { await api.post('/api/workouts', { date, exercises: updatedExercises, caloriesBurned: updatedCals !== undefined ? updatedCals : caloriesBurned }); }
    catch (err) { console.error('Save failed:', err); }
    finally { setSaving(false); }
  };

  const addExercise = (name) => {
    if (!name.trim()) return;
    const updated = [...exercises, { name: name.trim(), sets: [{ weight: 0, reps: 0 }], notes: '' }];
    setExercises(updated); save(updated); setShowAdd(false); setNewExercise(''); setSearchTerm('');
  };

  const removeExercise = (idx) => { const updated = exercises.filter((_, i) => i !== idx); setExercises(updated); save(updated); };

  const updateSet = (exIdx, setIdx, field, value) => {
    const updated = [...exercises];
    updated[exIdx] = { ...updated[exIdx], sets: [...updated[exIdx].sets] };
    updated[exIdx].sets[setIdx] = { ...updated[exIdx].sets[setIdx], [field]: Number(value) || 0 };
    const exName = updated[exIdx].name;
    const newWeight = updated[exIdx].sets[setIdx].weight;
    const currentPR = prs[exName]?.weight || 0;
    if (field === 'weight' && newWeight > currentPR && newWeight > 0) {
      setPrAlert({ exercise: exName, weight: newWeight });
      setPrs(prev => ({ ...prev, [exName]: { weight: newWeight, date } }));
      setTimeout(() => setPrAlert(null), 3000);
    }
    setExercises(updated);
  };

  const saveExercise = () => save(exercises);

  const addSet = (exIdx) => {
    const updated = [...exercises];
    const lastSet = updated[exIdx].sets[updated[exIdx].sets.length - 1];
    updated[exIdx] = { ...updated[exIdx], sets: [...updated[exIdx].sets, { weight: lastSet?.weight || 0, reps: lastSet?.reps || 0 }] };
    setExercises(updated); save(updated);
  };

  const removeSet = (exIdx, setIdx) => {
    const updated = [...exercises];
    updated[exIdx] = { ...updated[exIdx], sets: updated[exIdx].sets.filter((_, i) => i !== setIdx) };
    setExercises(updated); save(updated);
  };

  // Estimate calories burned from exercises + duration
  const estimateCalories = (sessionData) => {
    // MET-based estimation: ~5 MET for weight training
    const durationMin = (sessionData.duration || 0) / 60;
    const bodyWeight = 75; // kg default, could come from user profile
    const metValue = 5;
    const fromDuration = Math.round((metValue * bodyWeight * durationMin) / 60);
    // Also factor in volume: ~0.05 cal per kg lifted
    const totalVolume = sessionData.exercises.reduce((sum, ex) =>
      sum + ex.sets.reduce((s, set) => s + (set.weight * set.reps), 0), 0);
    const fromVolume = Math.round(totalVolume * 0.05);
    return Math.max(fromDuration, fromVolume, Math.round(durationMin * 5)); // at least 5 cal/min
  };

  // Handle session save — merges session data into today's workout + auto calorie tracking
  const handleSessionSave = async (sessionData) => {
    const mergedExercises = [...exercises, ...sessionData.exercises];
    const estimatedCals = estimateCalories(sessionData);
    const totalCals = caloriesBurned + estimatedCals;
    setExercises(mergedExercises);
    setCaloriesBurned(totalCals);
    await save(mergedExercises, totalCals);
    setSessionMode(false);
  };

  const filteredCommon = COMMON_EXERCISES.filter(e => e.toLowerCase().includes(searchTerm.toLowerCase()) && !exercises.some(ex => ex.name === e));
  const totalVolume = exercises.reduce((total, ex) => total + ex.sets.reduce((s, set) => s + (set.weight * set.reps), 0), 0);

  if (loading) return <div className="page-content"><div className="spinner" style={{ margin: '100px auto' }} /></div>;

  // SESSION MODE — render WorkoutSession component
  if (sessionMode) {
    return (
      <div className="page-content">
        <WorkoutSession
          onSave={handleSessionSave}
          onCancel={() => setSessionMode(false)}
        />
      </div>
    );
  }

  // NORMAL MODE — existing workout page
  return (
    <div className="page-content">
      {prAlert && <div className="pr-alert"><span className="pr-alert-icon">🏆</span><span>NEW PR! {prAlert.exercise}: {prAlert.weight}kg</span></div>}
      <h1 className="page-title">Workout Tracker 💪</h1>

      {/* Start Session Button */}
      <button className="btn session-start-btn" onClick={() => setSessionMode(true)}>
        <span className="session-start-icon">🎯</span>
        <span className="session-start-text">
          <strong>Start AI Workout Session</strong>
          <small>Auto-track reps with your camera using AI</small>
        </span>
        <span className="session-start-arrow">→</span>
      </button>

      {/* Tab toggle */}
      <div className="workout-tabs">
        <button className={`workout-tab ${workoutTab === 'log' ? 'active' : ''}`} onClick={() => setWorkoutTab('log')}>
          📝 Log
        </button>
        <button className={`workout-tab ${workoutTab === 'history' ? 'active' : ''}`} onClick={() => setWorkoutTab('history')}>
          📅 History
        </button>
      </div>

      {workoutTab === 'history' ? (
        <WorkoutCalendar />
      ) : (
      <>
      <div className="workout-top-bar">
        <input type="date" className="input date-input" value={date} onChange={e => setDate(e.target.value)} />
        <div className="workout-stats-bar">
          <span className="tag tag-green">{exercises.length} exercises</span>
          <span className="tag tag-blue">{totalVolume.toLocaleString()} kg volume</span>
          {saving && <span className="tag tag-orange">Saving...</span>}
        </div>
      </div>
      <div className="calories-burned-row">
        <label>🔥 Calories Burned</label>
        <input className="input" type="number" value={caloriesBurned} onChange={e => setCaloriesBurned(Number(e.target.value) || 0)} onBlur={() => save(exercises, Number(caloriesBurned) || 0)} placeholder="Estimated calories" style={{ maxWidth: 200 }} />
      </div>
      <div className="exercise-cards">
        {exercises.map((ex, exIdx) => (
          <div key={exIdx} className="card exercise-card">
            <div className="exercise-card-header">
              <div className="exercise-card-info">
                <h3 className="exercise-card-name">{ex.name}</h3>
                {prs[ex.name] && <span className="tag tag-green exercise-pr">PR: {prs[ex.name].weight}kg</span>}
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => removeExercise(exIdx)}>✕</button>
            </div>
            <div className="sets-table">
              <div className="sets-header"><span>Set</span><span>Weight (kg)</span><span>Reps</span><span>Volume</span><span></span></div>
              {ex.sets.map((set, setIdx) => (
                <div key={setIdx} className="set-row">
                  <span className="set-number">{setIdx + 1}</span>
                  <input className="input set-input" type="number" value={set.weight || ''} onChange={e => updateSet(exIdx, setIdx, 'weight', e.target.value)} onBlur={saveExercise} placeholder="0" />
                  <input className="input set-input" type="number" value={set.reps || ''} onChange={e => updateSet(exIdx, setIdx, 'reps', e.target.value)} onBlur={saveExercise} placeholder="0" />
                  <span className="set-volume">{(set.weight * set.reps).toLocaleString()}</span>
                  {ex.sets.length > 1 && <button className="btn btn-ghost btn-icon set-remove" onClick={() => removeSet(exIdx, setIdx)}>−</button>}
                </div>
              ))}
            </div>
            <button className="btn btn-ghost add-set-btn" onClick={() => addSet(exIdx)}>+ Add Set</button>
          </div>
        ))}
      </div>
      {!showAdd ? (
        <button className="btn btn-primary add-exercise-btn" onClick={() => setShowAdd(true)}>+ Add Exercise</button>
      ) : (
        <div className="card add-exercise-panel">
          <h3>Add Exercise</h3>
          <input className="input" placeholder="Search or type exercise name..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setNewExercise(e.target.value); }} autoFocus onKeyDown={e => e.key === 'Enter' && newExercise.trim() && addExercise(newExercise)} />
          <div className="exercise-suggestions">{filteredCommon.slice(0, 6).map(name => <button key={name} className="btn btn-secondary exercise-suggestion" onClick={() => addExercise(name)}>{name}</button>)}</div>
          {newExercise.trim() && !filteredCommon.includes(newExercise.trim()) && <button className="btn btn-primary" onClick={() => addExercise(newExercise)} style={{ marginTop: 8 }}>Add "{newExercise.trim()}"</button>}
          <button className="btn btn-ghost" onClick={() => { setShowAdd(false); setSearchTerm(''); setNewExercise(''); }} style={{ marginTop: 8 }}>Cancel</button>
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default Workout;
