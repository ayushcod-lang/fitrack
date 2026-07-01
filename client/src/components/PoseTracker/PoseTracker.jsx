/**
 * PoseTracker — Camera + Skeleton Overlay + Rep Counter + Form Feedback
 *
 * Full-screen modal component that:
 *   1. Opens the webcam
 *   2. Runs MoveNet Thunder for real-time pose estimation
 *   3. Draws skeleton overlay on canvas
 *   4. Counts reps via state machine
 *   5. Displays form cues, score, and phase indicator
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { initPoseDetector, estimatePose, disposePoseDetector, getVisibilityScore } from './poseDetector';
import { extractFeatures, FeatureBuffer } from './featureExtractor';
import { initFormClassifier, classify, disposeFormClassifier } from './formClassifier';
import { RepCounter } from './repCounter';
import { KEYPOINTS } from './exerciseConfig';
import { voiceCoach } from './voiceCoach';
import './PoseTracker.css';

// Skeleton connections for drawing
const SKELETON_CONNECTIONS = [
  [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER],
  [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.LEFT_ELBOW],
  [KEYPOINTS.LEFT_ELBOW, KEYPOINTS.LEFT_WRIST],
  [KEYPOINTS.RIGHT_SHOULDER, KEYPOINTS.RIGHT_ELBOW],
  [KEYPOINTS.RIGHT_ELBOW, KEYPOINTS.RIGHT_WRIST],
  [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.LEFT_HIP],
  [KEYPOINTS.RIGHT_SHOULDER, KEYPOINTS.RIGHT_HIP],
  [KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP],
  [KEYPOINTS.LEFT_HIP, KEYPOINTS.LEFT_KNEE],
  [KEYPOINTS.LEFT_KNEE, KEYPOINTS.LEFT_ANKLE],
  [KEYPOINTS.RIGHT_HIP, KEYPOINTS.RIGHT_KNEE],
  [KEYPOINTS.RIGHT_KNEE, KEYPOINTS.RIGHT_ANKLE],
];

const PoseTracker = ({ exerciseName, onComplete, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const repCounterRef = useRef(null);
  const featureBufferRef = useRef(null);
  const streamRef = useRef(null);

  const [status, setStatus] = useState('loading'); // loading | countdown | tracking | done
  const [countdown, setCountdown] = useState(3);
  const [repData, setRepData] = useState({ repCount: 0, formScore: 100, cue: null, state: 'IDLE', angle: 0 });
  const [visibility, setVisibility] = useState(0);
  const [error, setError] = useState(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const prevStateRef = useRef('IDLE');
  const [elapsedTime, setElapsedTime] = useState(0);

  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

// Initialize camera + ML models
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        setStatus('loading');

        // Request camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });

        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Load models in parallel
        await Promise.all([initPoseDetector(), initFormClassifier()]);

        if (cancelled) return;

        // Init tracking objects
        repCounterRef.current = new RepCounter(exerciseName);
        featureBufferRef.current = new FeatureBuffer(10);

        // Start countdown
        setStatus('countdown');
      } catch (err) {
        console.error('[PoseTracker] Init error:', err);
        if (!cancelled) {
          setError(err.name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera access and try again.'
            : `Failed to initialize: ${err.message}`
          );
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [exerciseName]);

// Countdown timer
  useEffect(() => {
    if (status !== 'countdown') return;

    if (countdown <= 0) {
      setStatus('tracking');
      startTimeRef.current = Date.now();
      return;
    }

    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [status, countdown]);

// Elapsed time tracker
  useEffect(() => {
    if (status !== 'tracking') return;

    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [status]);

// Main tracking loop
  useEffect(() => {
    if (status !== 'tracking') return;

    let running = true;

    const loop = async () => {
      if (!running || !videoRef.current) return;

      const keypoints = await estimatePose(videoRef.current);

      if (keypoints) {
        // Update visibility score
        const vis = getVisibilityScore(keypoints);
        setVisibility(vis);

        // Extract features + buffer
        const features = extractFeatures(keypoints);
        featureBufferRef.current.push(features);

        // Run classifier if buffer is full
        let classifierOutput = null;
        if (featureBufferRef.current.isFull()) {
          const sequence = featureBufferRef.current.getSequence();
          classifierOutput = classify(sequence);
        }

        // Update rep counter
        const state = repCounterRef.current.update(keypoints, classifierOutput);
        setRepData({ ...state });

        // Voice coaching announcements
        if (voiceEnabled) {
          voiceCoach.announceRep(state.repCount);
          if (state.cue) voiceCoach.announceCue(state.cue);
          voiceCoach.announcePhase(state.state, prevStateRef.current);
          prevStateRef.current = state.state;
        }

        // Draw skeleton on canvas
        drawSkeleton(keypoints, state);
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [status]);

// Draw skeleton
  const drawSkeleton = useCallback((keypoints, state) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;

    // Draw connections
    ctx.lineWidth = 3;
    for (const [startIdx, endIdx] of SKELETON_CONNECTIONS) {
      const start = keypoints[startIdx];
      const end = keypoints[endIdx];
      if (start.score > 0.3 && end.score > 0.3) {
        // Color based on form quality
        const hasIssue = state.formIssues?.some(issue => {
          const joints = [startIdx, endIdx];
          return joints.some(j =>
            j === KEYPOINTS.LEFT_KNEE || j === KEYPOINTS.RIGHT_KNEE ||
            j === KEYPOINTS.LEFT_HIP || j === KEYPOINTS.RIGHT_HIP
          );
        });

        ctx.strokeStyle = hasIssue
          ? 'rgba(255, 107, 107, 0.9)'
          : state.formScore >= 80
            ? 'rgba(0, 255, 135, 0.9)'
            : 'rgba(255, 167, 38, 0.9)';

        ctx.beginPath();
        ctx.moveTo(start.x * w, start.y * h);
        ctx.lineTo(end.x * w, end.y * h);
        ctx.stroke();
      }
    }

    // Draw keypoints
    for (let i = 5; i < keypoints.length; i++) {
      const kp = keypoints[i];
      if (kp.score > 0.3) {
        ctx.fillStyle = state.formScore >= 80
          ? 'rgba(0, 255, 135, 1)'
          : 'rgba(255, 167, 38, 1)';
        ctx.beginPath();
        ctx.arc(kp.x * w, kp.y * h, 5, 0, 2 * Math.PI);
        ctx.fill();

        // Outer ring
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }, []);

// Toggle voice coaching
  const toggleVoice = () => {
    const newVal = !voiceEnabled;
    setVoiceEnabled(newVal);
    voiceCoach.setEnabled(newVal);
    if (newVal && status === 'tracking') {
      voiceCoach.announceStart(exerciseName);
    }
  };

// Cleanup
  const cleanup = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    voiceCoach.reset();
    voiceCoach.setEnabled(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

// Stop tracking
  const handleStop = () => {
    if (voiceEnabled) voiceCoach.announceEnd(repData.repCount);
    cleanup();
    setStatus('done');
  };

// Complete and return data
  const handleComplete = () => {
    const data = {
      reps: repData.repCount,
      duration: elapsedTime,
      avgFormScore: repCounterRef.current?.repHistory?.length > 0
        ? Math.round(repCounterRef.current.repHistory.reduce((acc, r) =>
          acc + (r.quality === 'perfect' ? 100 : r.quality === 'good' ? 75 : 50), 0
        ) / repCounterRef.current.repHistory.length)
        : repData.formScore,
      repHistory: repCounterRef.current?.repHistory || [],
    };
    cleanup();
    onComplete(data);
  };

// Format time
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

// Error state
  if (error) {
    return (
      <div className="pose-tracker-modal">
        <div className="pose-tracker-error">
          <div className="pose-error-icon">📷</div>
          <h3>Camera Error</h3>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={onClose}>Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pose-tracker-modal">
      {/* Video + Canvas */}
      <div className="pose-video-container">
        <video
          ref={videoRef}
          className="pose-video"
          playsInline
          muted
          style={{ transform: 'scaleX(-1)' }}
        />
        <canvas
          ref={canvasRef}
          className="pose-canvas"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Loading overlay */}
        {status === 'loading' && (
          <div className="pose-overlay pose-loading">
            <div className="spinner" style={{ width: 60, height: 60, borderWidth: 4 }} />
            <p>Loading AI Models...</p>
            <span className="pose-loading-sub">MoveNet Thunder + Form Classifier</span>
          </div>
        )}

        {/* Countdown overlay */}
        {status === 'countdown' && (
          <div className="pose-overlay pose-countdown">
            <p className="pose-countdown-instruction">Position yourself so your full body is visible</p>
            <div className="pose-countdown-number">{countdown}</div>
            <p className="pose-countdown-exercise">{exerciseName}</p>
          </div>
        )}

        {/* Tracking HUD */}
        {status === 'tracking' && (
          <>
            {/* Top bar */}
            <div className="pose-hud-top">
              <div className="pose-exercise-label">{exerciseName}</div>
              <div className="pose-timer">{formatTime(elapsedTime)}</div>
            </div>

            {/* Rep counter (big center number) */}
            <div className="pose-rep-display">
              <div className="pose-rep-count">{repData.repCount}</div>
              <div className="pose-rep-label">REPS</div>
            </div>

            {/* Phase indicator */}
            <div className={`pose-phase-indicator phase-${repData.state.toLowerCase().replace('_', '-')}`}>
              {repData.state === 'AT_BOTTOM' ? '⬇ DOWN' :
               repData.state === 'AT_TOP' ? '⬆ UP' :
               repData.state === 'GOING_DOWN' ? '↓ GOING DOWN' :
               repData.state === 'GOING_UP' ? '↑ GOING UP' : '● READY'}
            </div>

            {/* Form score bar */}
            <div className="pose-form-bar">
              <div className="pose-form-label">
                <span>FORM</span>
                <span className={`pose-form-score ${repData.formScore >= 80 ? 'score-good' : repData.formScore >= 50 ? 'score-ok' : 'score-bad'}`}>
                  {repData.formScore}%
                </span>
              </div>
              <div className="pose-form-track">
                <div
                  className={`pose-form-fill ${repData.formScore >= 80 ? 'fill-good' : repData.formScore >= 50 ? 'fill-ok' : 'fill-bad'}`}
                  style={{ width: `${repData.formScore}%` }}
                />
              </div>
            </div>

            {/* Form cue */}
            {repData.cue && (
              <div className={`pose-cue cue-${repData.cue.severity}`}>
                {repData.cue.text}
              </div>
            )}

            {/* Visibility warning */}
            {visibility < 0.6 && (
              <div className="pose-visibility-warning">
                ⚠️ Step back — more of your body needs to be visible
              </div>
            )}

            {/* Angle debug (small) */}
            <div className="pose-angle-debug">
              {repData.angle}°
            </div>

            {/* Voice coaching toggle */}
            <button
              className={`btn pose-voice-btn ${voiceEnabled ? 'voice-on' : 'voice-off'}`}
              onClick={toggleVoice}
              title={voiceEnabled ? 'Disable voice coaching' : 'Enable voice coaching'}
            >
              {voiceEnabled ? '🔊 Voice ON' : '🔇 Voice OFF'}
            </button>

            {/* Stop button */}
            <button className="btn pose-stop-btn" onClick={handleStop}>
              ⏹ Stop
            </button>
          </>
        )}

        {/* Done screen */}
        {status === 'done' && (
          <div className="pose-overlay pose-done">
            <div className="pose-done-content">
              <div className="pose-done-icon">🎉</div>
              <h2>Set Complete!</h2>
              <div className="pose-done-stats">
                <div className="pose-done-stat">
                  <span className="pose-done-stat-value">{repData.repCount}</span>
                  <span className="pose-done-stat-label">Reps</span>
                </div>
                <div className="pose-done-stat">
                  <span className="pose-done-stat-value">{formatTime(elapsedTime)}</span>
                  <span className="pose-done-stat-label">Duration</span>
                </div>
                <div className="pose-done-stat">
                  <span className={`pose-done-stat-value ${repData.formScore >= 80 ? 'score-good' : 'score-ok'}`}>
                    {repData.formScore}%
                  </span>
                  <span className="pose-done-stat-label">Form Score</span>
                </div>
              </div>

              {/* Rep history */}
              {repCounterRef.current?.repHistory?.length > 0 && (
                <div className="pose-rep-history">
                  <h4>Rep Quality</h4>
                  <div className="pose-rep-dots">
                    {repCounterRef.current.repHistory.map((rep, i) => (
                      <div
                        key={i}
                        className={`pose-rep-dot quality-${rep.quality}`}
                        title={`Rep ${rep.rep}: ${rep.quality}${rep.issues.length > 0 ? ` (${rep.issues.join(', ')})` : ''}`}
                      >
                        {rep.rep}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pose-done-actions">
                <button className="btn btn-primary" onClick={handleComplete}>
                  ✓ Use These Reps
                </button>
                <button className="btn btn-ghost" onClick={onClose}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PoseTracker;
