import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import './Settings.css';

const Settings = () => {
  const { user, updateUser, logout } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '', age: user?.age || '', height: user?.height || '', weight: user?.weight || '',
    sex: user?.sex || 'male', activityLevel: user?.activityLevel || 'moderate', goal: user?.goal || 'maintenance',
    targetWeight: user?.targetWeight || '', calorieTarget: user?.calorieTarget || '', proteinTarget: user?.proteinTarget || '',
    carbsTarget: user?.carbsTarget || '', fatsTarget: user?.fatsTarget || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  const update = (field, value) => { setForm(prev => ({ ...prev, [field]: value })); setSaved(false); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, age: Number(form.age), height: Number(form.height), weight: Number(form.weight), targetWeight: form.targetWeight ? Number(form.targetWeight) : undefined };
      if (manualMode) { payload.calorieTarget = Number(form.calorieTarget); payload.proteinTarget = Number(form.proteinTarget); payload.carbsTarget = Number(form.carbsTarget); payload.fatsTarget = Number(form.fatsTarget); }
      const { data } = await api.put('/api/profile', payload);
      updateUser(data);
      if (!manualMode) setForm(prev => ({ ...prev, calorieTarget: data.calorieTarget, proteinTarget: data.proteinTarget, carbsTarget: data.carbsTarget, fatsTarget: data.fatsTarget }));
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error(err); alert('Failed to update profile'); }
    finally { setSaving(false); }
  };

  return (
    <div className="page-content">
      <h1 className="page-title">Settings ⚙️</h1>
      <p className="page-subtitle">Update your profile and nutrition targets</p>
      <div className="card settings-section">
        <h3 className="card-title">Profile</h3>
        <div className="grid-2">
          <div className="input-group"><label>Name</label><input className="input" value={form.name} onChange={e => update('name', e.target.value)} /></div>
          <div className="input-group"><label>Sex</label><select className="select" value={form.sex} onChange={e => update('sex', e.target.value)}><option value="male">Male</option><option value="female">Female</option></select></div>
          <div className="input-group"><label>Age</label><input className="input" type="number" value={form.age} onChange={e => update('age', e.target.value)} /></div>
          <div className="input-group"><label>Height (cm)</label><input className="input" type="number" value={form.height} onChange={e => update('height', e.target.value)} /></div>
          <div className="input-group"><label>Weight (kg)</label><input className="input" type="number" value={form.weight} onChange={e => update('weight', e.target.value)} /></div>
          <div className="input-group"><label>Target Weight</label><input className="input" type="number" value={form.targetWeight} onChange={e => update('targetWeight', e.target.value)} /></div>
        </div>
      </div>
      <div className="card settings-section">
        <h3 className="card-title">Fitness Goal</h3>
        <div className="grid-2">
          <div className="input-group"><label>Activity Level</label><select className="select" value={form.activityLevel} onChange={e => update('activityLevel', e.target.value)}><option value="sedentary">Sedentary</option><option value="light">Light</option><option value="moderate">Moderate</option><option value="active">Active</option><option value="very_active">Very Active</option></select></div>
          <div className="input-group"><label>Goal</label><select className="select" value={form.goal} onChange={e => update('goal', e.target.value)}><option value="fat_loss">🔥 Fat Loss</option><option value="muscle_gain">💪 Muscle Gain</option><option value="maintenance">⚖️ Maintenance</option></select></div>
        </div>
      </div>
      <div className="card settings-section">
        <div className="settings-section-header"><h3 className="card-title">Nutrition Targets</h3><button className={`btn btn-ghost ${manualMode ? 'active-toggle' : ''}`} onClick={() => setManualMode(!manualMode)}>{manualMode ? '🔧 Manual' : '🤖 Auto-calculated'}</button></div>
        {manualMode ? (
          <div className="grid-2">
            <div className="input-group"><label>Calories (kcal)</label><input className="input" type="number" value={form.calorieTarget} onChange={e => update('calorieTarget', e.target.value)} /></div>
            <div className="input-group"><label>Protein (g)</label><input className="input" type="number" value={form.proteinTarget} onChange={e => update('proteinTarget', e.target.value)} /></div>
            <div className="input-group"><label>Carbs (g)</label><input className="input" type="number" value={form.carbsTarget} onChange={e => update('carbsTarget', e.target.value)} /></div>
            <div className="input-group"><label>Fats (g)</label><input className="input" type="number" value={form.fatsTarget} onChange={e => update('fatsTarget', e.target.value)} /></div>
          </div>
        ) : (
          <div className="auto-targets-info">
            <p>Targets are auto-calculated from your profile. Save to recalculate.</p>
            <div className="auto-targets-grid">
              <div className="auto-target"><span className="auto-label">Calories</span><span className="auto-value">{form.calorieTarget || '—'} kcal</span></div>
              <div className="auto-target"><span className="auto-label">Protein</span><span className="auto-value accent-blue">{form.proteinTarget || '—'}g</span></div>
              <div className="auto-target"><span className="auto-label">Carbs</span><span className="auto-value accent-orange">{form.carbsTarget || '—'}g</span></div>
              <div className="auto-target"><span className="auto-label">Fats</span><span className="auto-value accent-purple">{form.fatsTarget || '—'}g</span></div>
            </div>
          </div>
        )}
      </div>
      <div className="settings-actions">
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Profile'}</button>
        <button className="btn btn-danger" onClick={logout}>Log Out</button>
      </div>
    </div>
  );
};

export default Settings;
