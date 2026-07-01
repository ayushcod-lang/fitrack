import { useState, useEffect } from 'react';
import api from '../../api';
import './Streaks.css';

/**
 * StreakWidget — Shows current workout streak with flame animation
 */
export const StreakWidget = () => {
  const [streaks, setStreaks] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/api/progress/streaks');
        setStreaks(data);
      } catch (err) { console.error('Streaks fetch error:', err); }
    })();
  }, []);

  if (!streaks) return null;

  const hasStreak = streaks.currentStreak > 0;

  return (
    <div className={`streak-widget ${!hasStreak ? 'no-streak' : ''}`}>
      <div className="streak-flame">
        <span className={`streak-flame-icon ${!hasStreak ? 'dim' : ''}`}>🔥</span>
        {hasStreak && <span className="streak-flame-count">{streaks.currentStreak}</span>}
      </div>
      <div className="streak-info">
        <div className="streak-title">
          {hasStreak
            ? `${streaks.currentStreak}-Day Streak!`
            : 'No Active Streak'}
        </div>
        <div className="streak-subtitle">
          {hasStreak
            ? 'Keep it going — don\'t break the chain!'
            : 'Work out today to start a streak'}
        </div>
      </div>
      <div className="streak-stats">
        <div className="streak-stat">
          <span className="streak-stat-value">{streaks.longestStreak}</span>
          <span className="streak-stat-label">Best</span>
        </div>
        <div className="streak-stat">
          <span className="streak-stat-value">{streaks.thisWeek}</span>
          <span className="streak-stat-label">This Week</span>
        </div>
        <div className="streak-stat">
          <span className="streak-stat-value">{streaks.thisMonth}</span>
          <span className="streak-stat-label">This Month</span>
        </div>
        <div className="streak-stat">
          <span className="streak-stat-value">{streaks.totalWorkouts}</span>
          <span className="streak-stat-label">Total</span>
        </div>
      </div>
    </div>
  );
};

/**
 * AchievementsBadges — Trigger button + modal with all achievements
 */
export const AchievementsBadges = () => {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/api/progress/achievements');
        setData(data);
      } catch (err) { console.error('Achievements fetch error:', err); }
    })();
  }, []);

  if (!data) return null;

  return (
    <>
      {/* Trigger button */}
      <button className="achievements-trigger" onClick={() => setOpen(true)}>
        <div className="achievements-trigger-left">
          <span className="achievements-trigger-icon">🏅</span>
          <div className="achievements-trigger-text">
            <strong>Achievements</strong>
            <small>{data.unlocked} of {data.total} unlocked</small>
          </div>
        </div>
        <span className="achievements-trigger-count">{data.unlocked}/{data.total} →</span>
      </button>

      {/* Modal */}
      {open && (
        <div className="achievements-overlay" onClick={() => setOpen(false)}>
          <div className="achievements-modal" onClick={e => e.stopPropagation()}>
            <div className="achievements-header">
              <h2>🏅 Achievements</h2>
              <div className="achievements-header-count">{data.unlocked} / {data.total} unlocked</div>
            </div>
            <div className="achievements-grid">
              {/* Unlocked first, then locked */}
              {[...data.achievements]
                .sort((a, b) => (b.condition ? 1 : 0) - (a.condition ? 1 : 0))
                .map(achievement => (
                  <div
                    key={achievement.id}
                    className={`achievement-item ${achievement.condition ? 'unlocked' : 'locked'}`}
                  >
                    <div className="achievement-icon">{achievement.icon}</div>
                    <div className="achievement-info">
                      <div className="achievement-name">{achievement.name}</div>
                      <div className="achievement-desc">{achievement.desc}</div>
                      {!achievement.condition && achievement.target && (
                        <div className="achievement-progress">
                          <div className="achievement-progress-bar">
                            <div
                              className="achievement-progress-fill"
                              style={{ width: `${((achievement.progress || 0) / achievement.target) * 100}%` }}
                            />
                          </div>
                          <div className="achievement-progress-text">
                            {(achievement.progress || 0).toLocaleString()} / {achievement.target.toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                    {achievement.condition && (
                      <span className="achievement-badge">✓ UNLOCKED</span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
