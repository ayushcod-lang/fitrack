import { useState, useRef, useEffect } from 'react';
import api from '../../api';
import './AICoach.css';

/**
 * AICoach — Floating chat widget for the AI Personal Trainer
 *
 * Accessible from any page via a floating action button.
 * Maintains conversation history and renders markdown-like responses.
 */
const AICoach = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hey! I'm your FitNex AI Coach 🏋️\n\nI know your workout history, nutrition, and PRs. Ask me anything — workout advice, form tips, plan generation, or progress analysis!",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage = { role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/api/coach/chat', {
        message: trimmed,
        conversationHistory: [...messages, userMessage].slice(-12),
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.reply,
      }]);
    } catch (err) {
      console.error('[AICoach] Error:', err);
      setError('Failed to get response. Please try again.');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I couldn't process that right now. Please try again in a moment.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      role: 'assistant',
      content: "Chat cleared! What would you like to know? 💪",
    }]);
  };

  // Suggested quick prompts
  const quickPrompts = [
    "How's my progress this week?",
    "Should I increase my squat weight?",
    "Generate a push day workout",
    "Am I eating enough protein?",
  ];

  // Simple markdown-like rendering
  const renderContent = (text) => {
    // Split by newlines and process
    return text.split('\n').map((line, i) => {
      // Bold text: **text**
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Italic text: *text*
      line = line.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
      // Bullet points
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return <div key={i} className="coach-msg-bullet" dangerouslySetInnerHTML={{ __html: '• ' + line.substring(2) }} />;
      }
      // Numbered lists
      if (/^\d+\.\s/.test(line)) {
        return <div key={i} className="coach-msg-list" dangerouslySetInnerHTML={{ __html: line }} />;
      }
      // Empty lines
      if (line.trim() === '') return <br key={i} />;
      // Normal text
      return <p key={i} dangerouslySetInnerHTML={{ __html: line }} />;
    });
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        className={`coach-fab ${isOpen ? 'coach-fab-active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="AI Coach"
        id="ai-coach-fab"
      >
        <span className="coach-fab-icon">{isOpen ? '✕' : '🤖'}</span>
        {!isOpen && <span className="coach-fab-pulse" />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="coach-window">
          {/* Header */}
          <div className="coach-header">
            <div className="coach-header-info">
              <div className="coach-avatar">🧠</div>
              <div>
                <h3 className="coach-title">FitNex Coach</h3>
                <span className="coach-status">
                  <span className="coach-status-dot" />
                  AI Personal Trainer
                </span>
              </div>
            </div>
            <button className="btn btn-ghost coach-clear-btn" onClick={clearChat} title="Clear chat">
              🗑️
            </button>
          </div>

          {/* Messages */}
          <div className="coach-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`coach-msg coach-msg-${msg.role}`}>
                {msg.role === 'assistant' && <div className="coach-msg-avatar">🧠</div>}
                <div className={`coach-msg-bubble coach-bubble-${msg.role}`}>
                  {renderContent(msg.content)}
                </div>
              </div>
            ))}

            {loading && (
              <div className="coach-msg coach-msg-assistant">
                <div className="coach-msg-avatar">🧠</div>
                <div className="coach-msg-bubble coach-bubble-assistant">
                  <div className="coach-typing">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}

            {/* Quick prompts (only show when few messages) */}
            {messages.length <= 1 && !loading && (
              <div className="coach-quick-prompts">
                {quickPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    className="coach-quick-btn"
                    onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="coach-input-area">
            {error && <div className="coach-error">{error}</div>}
            <div className="coach-input-wrapper">
              <textarea
                ref={inputRef}
                className="coach-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your AI coach..."
                rows={1}
                disabled={loading}
              />
              <button
                className={`coach-send-btn ${input.trim() && !loading ? 'active' : ''}`}
                onClick={sendMessage}
                disabled={!input.trim() || loading}
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AICoach;
