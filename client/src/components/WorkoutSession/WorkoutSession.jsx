/**
 * WorkoutSession — Active workout session manager
 *
 * Manages the entire workout session flow:
 *   - Session timer
 *   - Add exercises with search
 *   - Per-set Manual / Auto Track toggle
 *   - PoseTracker integration for auto-tracked sets
 *   - Save & End Session → POST /api/workouts
 */
import { useState, useEffect, useRef } from 'react';
import PoseTracker from '../PoseTracker/PoseTracker';
import { SUPPORTED_EXERCISES } from '../PoseTracker/exerciseConfig';
import './WorkoutSession.css';

const ALL_EXERCISES = [
  'Barbell Squat', 'Bench Press', 'Deadlift', 'Overhead Press', 'Barbell Row', 'Pull-ups',
  'Dumbbell Curl', 'Lateral Raise', 'Leg Press', 'Romanian Deadlift', 'Incline Bench Press',
  'Cable Fly', 'Tricep Pushdown', 'Leg Curl', 'Calf Raise', 'Dumbbell Shoulder Press', 'Push-ups',
];

const WorkoutSession = ({ onSave, onCancel }) => {
  const [exercises, setExercises] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTracker, setActiveTracker] = useState(null); // { exIdx, setIdx }
  const [sessionTime, setSessionTime] = useState(0);
  const [saving, setSaving] = useState(false);

  const startTimeRef = useRef(Date.now());

  // Session timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Add exercise
  const addExercise = (name) => {
    if (!name.trim()) return;
    setExercises(prev => [...prev, {
      name: name.trim(),
      sets: [{ weight: 0, reps: 0, trackingMode: 'manual', formScore: null }],
      notes: '',
    }]);
    setShowAdd(false);
    setSearchTerm('');
  };

  // Remove exercise
  const removeExercise = (idx) => {
    setExercises(prev => prev.filter((_, i) => i !== idx));
  };

  // Add set
  const addSet = (exIdx) => {
    setExercises(prev => {
      const updated = [...prev];
      const lastSet = updated[exIdx].sets[updated[exIdx].sets.length - 1];
      updated[exIdx] = {
        ...updated[exIdx],
        sets: [...updated[exIdx].sets, {
          weight: lastSet?.weight || 0,
          reps: lastSet?.reps || 0,
          trackingMode: 'manual',
          formScore: null,
        }],
      };
      return updated;
    });
  };

  // Remove set
  const removeSet = (exIdx, setIdx) => {
    setExercises(prev => {
      const updated = [...prev];
      updated[exIdx] = {
        ...updated[exIdx],
        sets: updated[exIdx].sets.filter((_, i) => i !== setIdx),
      };
      return updated;
    });
  };

  // Update set field
  const updateSet = (exIdx, setIdx, field, value) => {
    setExercises(prev => {
      const updated = [...prev];
      updated[exIdx] = { ...updated[exIdx], sets: [...updated[exIdx].sets] };
      updated[exIdx].sets[setIdx] = {
        ...updated[exIdx].sets[setIdx],
        [field]: field === 'weight' || field === 'reps' ? (Number(value) || 0) : value,
      };
      return updated;
    });
  };

  // Start auto tracking
  const startAutoTrack = (exIdx, setIdx) => {
    setActiveTracker({ exIdx, setIdx, exerciseName: exercises[exIdx].name });
  };

  // Handle auto tracking complete
  const handleTrackingComplete = (data) => {
    const { exIdx, setIdx } = activeTracker;
    setExercises(prev => {
      const updated = [...prev];
      updated[exIdx] = { ...updated[exIdx], sets: [...updated[exIdx].sets] };
      updated[exIdx].sets[setIdx] = {
        ...updated[exIdx].sets[setIdx],
        reps: data.reps,
        trackingMode: 'auto',
        formScore: data.avgFormScore,
        repHistory: data.repHistory,
      };
      return updated;
    });
    setActiveTracker(null);
  };

  // Save & end session
  const handleSave = async () => {
    if (exercises.length === 0) return;

    setSaving(true);
    const workoutData = {
      exercises: exercises.map(ex => ({
        name: ex.name,
        sets: ex.sets.map(s => ({ weight: s.weight, reps: s.reps })),
        notes: ex.notes,
      })),
      duration: sessionTime,
    };

    await onSave(workoutData);
    setSaving(false);
  };

  // Check if exercise supports auto-tracking
  const isAutoSupported = (exerciseName) => SUPPORTED_EXERCISES.includes(exerciseName);

  // Filter exercises for add panel
  const filteredExercises = ALL_EXERCISES.filter(e =>
    e.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !exercises.some(ex => ex.name === e)
  );

  // Total volume
  const totalVolume = exercises.reduce((total, ex) =>
    total + ex.sets.reduce((s, set) => s + (set.weight * set.reps), 0), 0
  );

  const totalSets = exercises.reduce((total, ex) => total + ex.sets.length, 0);

  return (
    <div className="workout-session">
      {/* Active PoseTracker modal */}
      {activeTracker && (
        <PoseTracker
          exerciseName={activeTracker.exerciseName}
          onComplete={handleTrackingComplete}
          onClose={() => setActiveTracker(null)}
        />
      )}

      {/* Session header */}
      <div className="session-header">
        <div className="session-header-left">
          <div className="session-live-badge">
            <span className="session-live-dot" />
            LIVE SESSION
          </div>
          <div className="session-timer">{formatTime(sessionTime)}</div>
        </div>
        <div className="session-header-right">
          <span className="tag tag-green">{exercises.length} exercises</span>
          <span className="tag tag-blue">{totalSets} sets</span>
          <span className="tag tag-orange">{totalVolume.toLocaleString()} kg</span>
        </div>
      </div>

      {/* Exercise cards */}
      <div className="session-exercises">
        {exercises.map((ex, exIdx) => (
          <div key={exIdx} className="card session-exercise-card">
            <div className="session-ex-header">
              <div className="session-ex-info">
                <h3 className="session-ex-name">{ex.name}</h3>
                {isAutoSupported(ex.name) && (
                  <span className="tag tag-ai">🤖 AI Ready</span>
                )}
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => removeExercise(exIdx)}>✕</button>
            </div>

            {/* Sets */}
            <div className="session-sets">
              <div className="session-sets-header">
                <span>Set</span>
                <span>Weight (kg)</span>
                <span>Reps</span>
                <span>Tracking</span>
                <span></span>
              </div>
              {ex.sets.map((set, setIdx) => (
                <div key={setIdx} className="session-set-row">
                  <span className="set-number">{setIdx + 1}</span>
                  <input
                    className="input set-input"
                    type="number"
                    value={set.weight || ''}
                    onChange={e => updateSet(exIdx, setIdx, 'weight', e.target.value)}
                    placeholder="0"
                  />
                  <input
                    className="input set-input"
                    type="number"
                    value={set.reps || ''}
                    onChange={e => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                    placeholder="0"
                  />
                  <div className="session-tracking-btns">
                    {isAutoSupported(ex.name) ? (
                      <button
                        className="btn btn-auto-track"
                        onClick={() => startAutoTrack(exIdx, setIdx)}
                      >
                        📷 Auto
                      </button>
                    ) : (
                      <span className="session-manual-tag">Manual</span>
                    )}
                    {set.formScore !== null && (
                      <span className={`session-form-badge ${set.formScore >= 80 ? 'badge-good' : set.formScore >= 50 ? 'badge-ok' : 'badge-bad'}`}>
                        {set.formScore}%
                      </span>
                    )}
                  </div>
                  <div className="session-set-actions">
                    {ex.sets.length > 1 && (
                      <button className="btn btn-ghost btn-icon set-remove" onClick={() => removeSet(exIdx, setIdx)}>−</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button className="btn btn-ghost add-set-btn" onClick={() => addSet(exIdx)}>
              + Add Set
            </button>
          </div>
        ))}
      </div>

      {/* Add exercise */}
      {!showAdd ? (
        <button className="btn btn-secondary session-add-btn" onClick={() => setShowAdd(true)}>
          + Add Exercise
        </button>
      ) : (
        <div className="card session-add-panel">
          <h3>Add Exercise</h3>
          <input
            className="input"
            placeholder="Search exercise..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && searchTerm.trim() && addExercise(searchTerm)}
          />
          <div className="session-exercise-suggestions">
            {filteredExercises.slice(0, 8).map(name => (
              <button
                key={name}
                className={`btn btn-secondary exercise-suggestion ${isAutoSupported(name) ? 'ai-supported' : ''}`}
                onClick={() => addExercise(name)}
              >
                {isAutoSupported(name) && <span className="ai-dot">🤖</span>}
                {name}
              </button>
            ))}
          </div>
          {searchTerm.trim() && !filteredExercises.includes(searchTerm.trim()) && (
            <button className="btn btn-primary" onClick={() => addExercise(searchTerm)} style={{ marginTop: 8 }}>
              Add "{searchTerm.trim()}"
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => { setShowAdd(false); setSearchTerm(''); }} style={{ marginTop: 8 }}>
            Cancel
          </button>
        </div>
      )}

      {/* Empty state */}
      {exercises.length === 0 && !showAdd && (
        <div className="session-empty">
          <p>💪 Add your first exercise to start tracking!</p>
          <p className="session-empty-sub">Exercises with 🤖 support AI auto-tracking</p>
        </div>
      )}

      {/* Bottom bar */}
      <div className="session-bottom-bar">
        <button className="btn btn-ghost" onClick={onCancel}>
          Cancel Session
        </button>
        <button
          className="btn btn-primary session-save-btn"
          onClick={handleSave}
          disabled={exercises.length === 0 || saving}
        >
          {saving ? 'Saving...' : '✓ Save & End Session'}
        </button>
      </div>
    </div>
  );
};

export default WorkoutSession;
