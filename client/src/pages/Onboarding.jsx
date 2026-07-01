import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import './Onboarding.css';

const steps = ['basics', 'body', 'activity', 'review'];

const Onboarding = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '', age: '', height: '', weight: '', sex: 'male',
    activityLevel: 'moderate', goal: 'maintenance', targetWeight: '',
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const canProceed = () => {
    switch (currentStep) {
      case 0: return form.name.trim().length > 0;
      case 1: return form.age > 0 && form.height > 0 && form.weight > 0;
      case 2: return form.activityLevel && form.goal;
      default: return true;
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/api/profile', {
        ...form, age: Number(form.age), height: Number(form.height), weight: Number(form.weight),
        targetWeight: form.targetWeight ? Number(form.targetWeight) : undefined,
      });
      updateUser(data);
      navigate('/');
    } catch (err) {
      console.error('Profile update failed:', err);
      alert('Failed to save profile. Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <div className="onboarding-header">
          <h1>Welcome to <span className="highlight">FitNex</span> ⚡</h1>
          <p>Let's set up your fitness profile</p>
        </div>
        <div className="onboarding-progress">
          {steps.map((s, i) => (
            <div key={s} className={`progress-step ${i <= currentStep ? 'active' : ''} ${i < currentStep ? 'done' : ''}`}>
              <div className="progress-dot">{i < currentStep ? '✓' : i + 1}</div>
              <span className="progress-label">{s}</span>
            </div>
          ))}
        </div>

        {currentStep === 0 && (
          <div className="onboarding-step" key="basics">
            <h2>What should we call you?</h2>
            <div className="input-group">
              <label>Your Name</label>
              <input className="input" value={form.name} onChange={e => update('name', e.target.value)} placeholder="Enter your name" autoFocus />
            </div>
            <div className="input-group" style={{ marginTop: 16 }}>
              <label>Sex</label>
              <div className="toggle-group">
                <button className={`toggle-btn ${form.sex === 'male' ? 'active' : ''}`} onClick={() => update('sex', 'male')}>♂ Male</button>
                <button className={`toggle-btn ${form.sex === 'female' ? 'active' : ''}`} onClick={() => update('sex', 'female')}>♀ Female</button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="onboarding-step" key="body">
            <h2>Your Body Stats</h2>
            <div className="grid-2">
              <div className="input-group"><label>Age</label><input className="input" type="number" value={form.age} onChange={e => update('age', e.target.value)} placeholder="25" /></div>
              <div className="input-group"><label>Height (cm)</label><input className="input" type="number" value={form.height} onChange={e => update('height', e.target.value)} placeholder="175" /></div>
              <div className="input-group"><label>Weight (kg)</label><input className="input" type="number" value={form.weight} onChange={e => update('weight', e.target.value)} placeholder="70" /></div>
              <div className="input-group"><label>Target Weight (optional)</label><input className="input" type="number" value={form.targetWeight} onChange={e => update('targetWeight', e.target.value)} placeholder="65" /></div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="onboarding-step" key="activity">
            <h2>Activity & Goals</h2>
            <div className="input-group">
              <label>Activity Level</label>
              <select className="select" value={form.activityLevel} onChange={e => update('activityLevel', e.target.value)}>
                <option value="sedentary">Sedentary (desk job)</option>
                <option value="light">Light (1-3 days/week)</option>
                <option value="moderate">Moderate (3-5 days/week)</option>
                <option value="active">Active (6-7 days/week)</option>
                <option value="very_active">Very Active (athlete)</option>
              </select>
            </div>
            <div className="input-group" style={{ marginTop: 16 }}>
              <label>Fitness Goal</label>
              <div className="goal-cards">
                {[
                  { key: 'fat_loss', icon: '🔥', title: 'Fat Loss', desc: 'Burn fat, get lean' },
                  { key: 'muscle_gain', icon: '💪', title: 'Muscle Gain', desc: 'Build size & strength' },
                  { key: 'maintenance', icon: '⚖️', title: 'Maintenance', desc: 'Stay where you are' },
                ].map(opt => (
                  <button key={opt.key} className={`goal-card ${form.goal === opt.key ? 'active' : ''}`} onClick={() => update('goal', opt.key)}>
                    <span className="goal-card-icon">{opt.icon}</span>
                    <span className="goal-card-title">{opt.title}</span>
                    <span className="goal-card-desc">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="onboarding-step" key="review">
            <h2>Review Your Profile</h2>
            <div className="review-grid">
              <div className="review-item"><span>Name</span><strong>{form.name}</strong></div>
              <div className="review-item"><span>Sex</span><strong>{form.sex === 'male' ? '♂ Male' : '♀ Female'}</strong></div>
              <div className="review-item"><span>Age</span><strong>{form.age} years</strong></div>
              <div className="review-item"><span>Height</span><strong>{form.height} cm</strong></div>
              <div className="review-item"><span>Weight</span><strong>{form.weight} kg</strong></div>
              {form.targetWeight && <div className="review-item"><span>Target</span><strong>{form.targetWeight} kg</strong></div>}
              <div className="review-item"><span>Activity</span><strong>{form.activityLevel.replace('_', ' ')}</strong></div>
              <div className="review-item"><span>Goal</span><strong className="highlight">{form.goal.replace('_', ' ')}</strong></div>
            </div>
          </div>
        )}

        <div className="onboarding-nav">
          {currentStep > 0 && <button className="btn btn-secondary" onClick={() => setCurrentStep(p => p - 1)}>Back</button>}
          <div style={{ flex: 1 }} />
          {currentStep < 3 ? (
            <button className="btn btn-primary" disabled={!canProceed()} onClick={() => setCurrentStep(p => p + 1)}>Continue</button>
          ) : (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Setting up...' : '🚀 Start Tracking'}</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
