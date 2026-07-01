import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import api from '../api';
import './Progress.css';

const Progress = () => {
  const [data, setData] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [exerciseHistory, setExerciseHistory] = useState([]);
  const [weightInput, setWeightInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [progRes, exRes] = await Promise.all([api.get('/api/progress', { params: { days } }), api.get('/api/progress/exercises')]);
        setData(progRes.data); setExercises(exRes.data);
        if (exRes.data.length > 0 && !selectedExercise) setSelectedExercise(exRes.data[0]);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, [days]);

  useEffect(() => {
    if (!selectedExercise) return;
    (async () => {
      try { const { data } = await api.get(`/api/workouts/history/${encodeURIComponent(selectedExercise)}`); setExerciseHistory(data); }
      catch (err) { console.error(err); }
    })();
  }, [selectedExercise]);

  const logWeight = async () => {
    if (!weightInput) return;
    try {
      await api.post('/api/progress/weight', { date: new Date().toISOString().split('T')[0], weight: Number(weightInput) });
      setWeightInput('');
      const { data: progData } = await api.get('/api/progress', { params: { days } });
      setData(progData);
    } catch (err) { console.error(err); }
  };

  const customTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (<div className="chart-tooltip"><p className="chart-tooltip-label">{label}</p>{payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</p>)}</div>);
  };

  if (loading) return <div className="page-content"><div className="spinner" style={{ margin: '100px auto' }} /></div>;

  const prData = selectedExercise && data?.prHistory?.[selectedExercise] ? data.prHistory[selectedExercise].map(d => ({ ...d, date: d.date.slice(5) })) : [];
  const volumeData = (data?.volumeHistory || []).map(d => ({ ...d, date: d.date.slice(5) }));
  const calorieData = (data?.calorieHistory || []).map(d => ({ ...d, date: d.date.slice(5) }));
  const bodyWeightData = (data?.bodyWeights || []).map(d => ({ date: d.date.slice(5), weight: d.weight }));

  return (
    <div className="page-content">
      <h1 className="page-title">Progress & Analytics 📈</h1>
      <p className="page-subtitle">Track your fitness journey over time</p>
      <div className="progress-controls">
        <div className="period-selector">
          {[7, 30, 90].map(d => <button key={d} className={`btn btn-ghost ${days === d ? 'active-period' : ''}`} onClick={() => setDays(d)}>{d}D</button>)}
        </div>
        <div className="weight-logger">
          <input className="input" type="number" placeholder="Log weight (kg)" value={weightInput} onChange={e => setWeightInput(e.target.value)} style={{ maxWidth: 160 }} />
          <button className="btn btn-primary" onClick={logWeight} disabled={!weightInput}>Log</button>
        </div>
      </div>
      <div className="charts-grid">
        <div className="card chart-card">
          <h3 className="card-title">Body Weight</h3>
          {bodyWeightData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}><AreaChart data={bodyWeightData}>
              <defs><linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00FF87" stopOpacity={0.3} /><stop offset="95%" stopColor="#00FF87" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" /><XAxis dataKey="date" stroke="#64748B" fontSize={11} /><YAxis stroke="#64748B" fontSize={11} domain={['dataMin - 2', 'dataMax + 2']} />
              <Tooltip content={customTooltip} /><Area type="monotone" dataKey="weight" stroke="#00FF87" fill="url(#weightGrad)" strokeWidth={2} name="Weight (kg)" />
            </AreaChart></ResponsiveContainer>
          ) : <div className="empty-state"><p>No weight data yet. Log your weight above!</p></div>}
        </div>
        <div className="card chart-card">
          <div className="chart-card-header">
            <h3 className="card-title">PR Progression</h3>
            {exercises.length > 0 && <select className="select chart-select" value={selectedExercise} onChange={e => setSelectedExercise(e.target.value)}>{exercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}</select>}
          </div>
          {prData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}><LineChart data={prData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" /><XAxis dataKey="date" stroke="#64748B" fontSize={11} /><YAxis stroke="#64748B" fontSize={11} />
              <Tooltip content={customTooltip} /><Line type="monotone" dataKey="weight" stroke="#00D4FF" strokeWidth={2} dot={{ fill: '#00D4FF', r: 4 }} name="PR (kg)" />
            </LineChart></ResponsiveContainer>
          ) : <div className="empty-state"><p>No PR data for this exercise</p></div>}
        </div>
        <div className="card chart-card">
          <h3 className="card-title">Workout Volume</h3>
          {volumeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}><AreaChart data={volumeData}>
              <defs><linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#A78BFA" stopOpacity={0.3} /><stop offset="95%" stopColor="#A78BFA" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" /><XAxis dataKey="date" stroke="#64748B" fontSize={11} /><YAxis stroke="#64748B" fontSize={11} />
              <Tooltip content={customTooltip} /><Area type="monotone" dataKey="volume" stroke="#A78BFA" fill="url(#volGrad)" strokeWidth={2} name="Volume (kg)" />
            </AreaChart></ResponsiveContainer>
          ) : <div className="empty-state"><p>No workout data yet</p></div>}
        </div>
        <div className="card chart-card">
          <h3 className="card-title">Calorie Intake Trend</h3>
          {calorieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}><AreaChart data={calorieData}>
              <defs><linearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#FFA726" stopOpacity={0.3} /><stop offset="95%" stopColor="#FFA726" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" /><XAxis dataKey="date" stroke="#64748B" fontSize={11} /><YAxis stroke="#64748B" fontSize={11} />
              <Tooltip content={customTooltip} /><Area type="monotone" dataKey="calories" stroke="#FFA726" fill="url(#calGrad)" strokeWidth={2} name="Calories" />
            </AreaChart></ResponsiveContainer>
          ) : <div className="empty-state"><p>No diet data yet</p></div>}
        </div>
      </div>
    </div>
  );
};

export default Progress;
