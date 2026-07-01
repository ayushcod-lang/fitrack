import { useState, useEffect } from 'react';
import api from '../../api';
import './WorkoutCalendar.css';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const WorkoutCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState({});
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  useEffect(() => {
    const fetchCalendar = async () => {
      setLoading(true);
      try {
        const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
        const { data } = await api.get('/api/workouts/calendar', { params: { month: monthStr } });
        setCalendarData(data);
      } catch (err) { console.error('Calendar fetch error:', err); }
      finally { setLoading(false); }
    };
    fetchCalendar();
  }, [year, month]);

  // Navigate months
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  };
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
  };

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const cells = [];
  // Empty cells for padding
  for (let i = 0; i < firstDay; i++) {
    cells.push({ day: null, dateStr: null });
  }
  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr });
  }

  // Volume intensity color (0-4 scale)
  const getIntensity = (dateStr) => {
    const data = calendarData[dateStr];
    if (!data) return 0;
    if (data.volume > 5000) return 4;
    if (data.volume > 3000) return 3;
    if (data.volume > 1000) return 2;
    return 1;
  };

  // Selected day data
  const selectedData = selectedDay ? calendarData[selectedDay] : null;

  return (
    <div className="workout-calendar">
      {/* Month navigator */}
      <div className="cal-header">
        <button className="btn btn-ghost cal-nav-btn" onClick={prevMonth}>←</button>
        <h3 className="cal-month-title">{MONTH_NAMES[month]} {year}</h3>
        <button className="btn btn-ghost cal-nav-btn" onClick={nextMonth}>→</button>
      </div>

      {/* Day labels */}
      <div className="cal-day-labels">
        {DAYS_OF_WEEK.map(d => <span key={d} className="cal-day-label">{d}</span>)}
      </div>

      {/* Calendar grid */}
      <div className="cal-grid">
        {cells.map((cell, i) => {
          if (!cell.day) return <div key={i} className="cal-cell cal-cell-empty" />;

          const intensity = getIntensity(cell.dateStr);
          const isToday = cell.dateStr === today;
          const isSelected = cell.dateStr === selectedDay;
          const hasWorkout = intensity > 0;

          return (
            <div
              key={i}
              className={`cal-cell ${hasWorkout ? `cal-cell-active intensity-${intensity}` : ''} ${isToday ? 'cal-cell-today' : ''} ${isSelected ? 'cal-cell-selected' : ''}`}
              onClick={() => hasWorkout && setSelectedDay(isSelected ? null : cell.dateStr)}
            >
              <span className="cal-cell-day">{cell.day}</span>
              {hasWorkout && <span className="cal-cell-dot" />}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="cal-legend">
        <span className="cal-legend-label">Less</span>
        <span className="cal-legend-box intensity-0" />
        <span className="cal-legend-box intensity-1" />
        <span className="cal-legend-box intensity-2" />
        <span className="cal-legend-box intensity-3" />
        <span className="cal-legend-box intensity-4" />
        <span className="cal-legend-label">More</span>
      </div>

      {/* Selected day details */}
      {selectedData && (
        <div className="cal-detail card">
          <div className="cal-detail-header">
            <h4>{selectedDay}</h4>
            <button className="btn btn-ghost btn-icon" onClick={() => setSelectedDay(null)}>✕</button>
          </div>
          <div className="cal-detail-stats">
            <div className="cal-detail-stat">
              <span className="cal-detail-value">{selectedData.exerciseCount}</span>
              <span className="cal-detail-label">Exercises</span>
            </div>
            <div className="cal-detail-stat">
              <span className="cal-detail-value">{selectedData.setCount}</span>
              <span className="cal-detail-label">Sets</span>
            </div>
            <div className="cal-detail-stat">
              <span className="cal-detail-value">{selectedData.volume.toLocaleString()}</span>
              <span className="cal-detail-label">Volume (kg)</span>
            </div>
            {selectedData.caloriesBurned > 0 && (
              <div className="cal-detail-stat">
                <span className="cal-detail-value">{selectedData.caloriesBurned}</span>
                <span className="cal-detail-label">Cal Burned</span>
              </div>
            )}
          </div>
          <div className="cal-detail-exercises">
            {selectedData.exercises.map((name, i) => (
              <span key={i} className="tag tag-blue">{name}</span>
            ))}
          </div>
        </div>
      )}

      {loading && <div className="spinner" style={{ margin: '20px auto' }} />}
    </div>
  );
};

export default WorkoutCalendar;
