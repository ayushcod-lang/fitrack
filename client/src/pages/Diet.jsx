import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import './Diet.css';

const today = () => new Date().toISOString().split('T')[0];

const Diet = () => {
  const { user } = useAuth();
  const [date, setDate] = useState(today());
  const [mealText, setMealText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLog = async () => {
      setLoading(true);
      try { const { data } = await api.get('/api/diet', { params: { date } }); setEntries(data.entries || []); }
      catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchLog();
  }, [date]);

  const analyze = async () => {
    if (!mealText.trim()) return;
    setAnalyzing(true); setAnalysisResult(null);
    try { const { data } = await api.post('/api/diet/analyze', { text: mealText.trim() }); setAnalysisResult(data); }
    catch (err) { alert(err.response?.data?.message || 'AI analysis failed'); }
    finally { setAnalyzing(false); }
  };

  const addToLog = async () => {
    if (!analysisResult) return;
    try {
      const { data } = await api.post('/api/diet', { date, entry: { text: mealText.trim(), ...analysisResult } });
      setEntries(data.entries); setMealText(''); setAnalysisResult(null);
    } catch (err) { console.error(err); }
  };

  const removeEntry = async (entryId) => {
    try { const { data } = await api.delete(`/api/diet/${date}/entry/${entryId}`); setEntries(data.entries); }
    catch (err) { console.error(err); }
  };

  const totals = entries.reduce((acc, e) => ({ calories: acc.calories + (e.calories || 0), protein: acc.protein + (e.protein || 0), carbs: acc.carbs + (e.carbs || 0), fats: acc.fats + (e.fats || 0) }), { calories: 0, protein: 0, carbs: 0, fats: 0 });
  const calorieTarget = user?.calorieTarget || 2000;

  return (
    <div className="page-content">
      <h1 className="page-title">Diet Tracker 🍎</h1>
      <p className="page-subtitle">Describe your meals in natural language — AI estimates the nutrition</p>
      <div className="diet-top"><input type="date" className="input date-input" value={date} onChange={e => setDate(e.target.value)} /></div>
      <div className="card diet-input-card">
        <h3 className="card-title">Log a Meal 🤖</h3>
        <textarea className="input diet-textarea" rows={3} placeholder='e.g., "2 roti + dal + rice" or "1 chicken breast with salad"' value={mealText} onChange={e => setMealText(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), analyze())} />
        <button className="btn btn-primary diet-analyze-btn" onClick={analyze} disabled={analyzing || !mealText.trim()}>{analyzing ? '🔄 Analyzing...' : '✨ Analyze with AI'}</button>
      </div>
      {analysisResult && (
        <div className="card diet-result-card">
          <h3 className="card-title">Nutritional Estimate</h3>
          <div className="result-totals">
            <div className="result-total-item"><span className="result-total-value calories">{analysisResult.calories}</span><span className="result-total-label">Calories</span></div>
            <div className="result-total-item"><span className="result-total-value protein">{analysisResult.protein}g</span><span className="result-total-label">Protein</span></div>
            <div className="result-total-item"><span className="result-total-value carbs">{analysisResult.carbs}g</span><span className="result-total-label">Carbs</span></div>
            <div className="result-total-item"><span className="result-total-value fats">{analysisResult.fats}g</span><span className="result-total-label">Fats</span></div>
          </div>
          {analysisResult.items?.length > 0 && (
            <div className="result-items">{analysisResult.items.map((item, i) => (
              <div key={i} className="result-item"><span className="result-item-name">{item.name}</span><span className="result-item-cal">{item.calories} kcal</span><span className="result-item-macro">P:{item.protein}g C:{item.carbs}g F:{item.fats}g</span></div>
            ))}</div>
          )}
          <div className="result-actions"><button className="btn btn-primary" onClick={addToLog}>✓ Add to Log</button><button className="btn btn-ghost" onClick={() => setAnalysisResult(null)}>Discard</button></div>
        </div>
      )}
      <div className="card diet-summary-card">
        <h3 className="card-title">Daily Summary</h3>
        <div className="diet-summary-stats">
          <div className="diet-summary-stat">
            <span className="diet-stat-value">{totals.calories}</span><span className="diet-stat-label">/ {calorieTarget} kcal</span>
            <div className="progress-bar" style={{ marginTop: 8 }}><div className="progress-bar-fill" style={{ width: `${Math.min((totals.calories / calorieTarget) * 100, 100)}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-secondary))' }} /></div>
          </div>
          <div className="diet-summary-macros"><span className="macro-pill protein">P: {totals.protein}g</span><span className="macro-pill carbs">C: {totals.carbs}g</span><span className="macro-pill fats">F: {totals.fats}g</span></div>
        </div>
      </div>
      <div className="diet-log">
        <h3 className="card-title">Food Log</h3>
        {loading ? <div className="spinner" style={{ margin: '40px auto' }} /> : entries.length === 0 ? <div className="empty-state"><p>No meals logged for this day</p></div> : (
          <div className="diet-entries">{entries.map((entry, i) => (
            <div key={entry._id || i} className="card diet-entry">
              <div className="diet-entry-header"><span className="diet-entry-text">{entry.text}</span><button className="btn btn-ghost btn-icon" onClick={() => removeEntry(entry._id)}>✕</button></div>
              <div className="diet-entry-macros"><span className="tag tag-green">{entry.calories} kcal</span><span className="tag tag-blue">P: {entry.protein}g</span><span className="tag tag-orange">C: {entry.carbs}g</span><span style={{ color: 'var(--fats)', fontSize: 12, fontWeight: 600 }}>F: {entry.fats}g</span></div>
            </div>
          ))}</div>
        )}
      </div>
    </div>
  );
};

export default Diet;
