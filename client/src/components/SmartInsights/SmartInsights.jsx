import { useState } from 'react';
import api from '../../api';
import './SmartInsights.css';

/**
 * SmartInsights — AI-generated weekly analytics widget for Dashboard
 *
 * Fetches personalized insights from the Gemini-powered backend
 * that analyze workout patterns, nutrition gaps, and progressive overload trends.
 */
const SmartInsights = () => {
  const [insights, setInsights] = useState([{
    icon: '💡',
    title: 'Ready to Analyze',
    text: 'Click the refresh button to generate AI-powered insights from your training data.',
    type: 'info',
  }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastGenerated, setLastGenerated] = useState(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/coach/insights');
      setInsights(res.data.insights || []);
      setLastGenerated(res.data.generatedAt);
    } catch (err) {
      setError('Failed to refresh');
    } finally {
      setLoading(false);
    }
  };

  const typeColors = {
    success: { bg: 'rgba(0, 255, 135, 0.08)', border: 'rgba(0, 255, 135, 0.2)', color: '#00ff87' },
    warning: { bg: 'rgba(255, 167, 38, 0.08)', border: 'rgba(255, 167, 38, 0.2)', color: '#ffa726' },
    tip: { bg: 'rgba(0, 210, 255, 0.08)', border: 'rgba(0, 210, 255, 0.2)', color: '#00d2ff' },
    info: { bg: 'rgba(156, 136, 255, 0.08)', border: 'rgba(156, 136, 255, 0.2)', color: '#9c88ff' },
  };

  return (
    <div className="card smart-insights-card">
      <div className="smart-insights-header">
        <div className="smart-insights-title-row">
          <h3 className="card-title">🧠 Smart Insights</h3>
          <span className="smart-insights-badge">AI Powered</span>
        </div>
        <button
          className="btn btn-ghost smart-insights-refresh"
          onClick={refresh}
          disabled={loading}
          title="Refresh insights"
        >
          {loading ? '⏳' : '🔄'}
        </button>
      </div>

      {loading && insights.length === 0 ? (
        <div className="smart-insights-loading">
          <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
          <span>Analyzing your data...</span>
        </div>
      ) : (
        <div className="smart-insights-grid">
          {insights.map((insight, i) => {
            const colors = typeColors[insight.type] || typeColors.info;
            return (
              <div
                key={i}
                className="smart-insight-item"
                style={{
                  background: colors.bg,
                  borderColor: colors.border,
                }}
              >
                <div className="smart-insight-icon" style={{ color: colors.color }}>
                  {insight.icon}
                </div>
                <div className="smart-insight-content">
                  <h4 className="smart-insight-title" style={{ color: colors.color }}>
                    {insight.title}
                  </h4>
                  <p className="smart-insight-text">{insight.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="smart-insights-error">{error}</p>}

      {lastGenerated && (
        <p className="smart-insights-timestamp">
          Last updated: {new Date(lastGenerated).toLocaleString()}
        </p>
      )}
    </div>
  );
};

export default SmartInsights;
