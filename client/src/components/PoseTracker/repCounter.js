/**
 * repCounter.js — State machine for rep counting
 *
 * Uses the exercise-specific primary angle to detect phase transitions
 * (UP → DOWN → UP = 1 rep). Augments with form classifier output when available.
 *
 * State Machine:
 *   IDLE → DOWN → UP → DOWN → UP → ...
 *   Each UP→DOWN→UP transition = 1 rep
 */
import { getExerciseConfig } from './exerciseConfig.js';

export const REP_STATES = {
  IDLE: 'IDLE',
  GOING_DOWN: 'GOING_DOWN',
  AT_BOTTOM: 'AT_BOTTOM',
  GOING_UP: 'GOING_UP',
  AT_TOP: 'AT_TOP',
};

export class RepCounter {
  constructor(exerciseName) {
    this.exerciseName = exerciseName;
    this.config = getExerciseConfig(exerciseName);
    this.state = REP_STATES.IDLE;
    this.repCount = 0;
    this.currentAngle = 0;
    this.formIssues = [];
    this.formScore = 100;
    this.currentCue = null;
    this.lastCueTime = 0;
    this.prevKeypoints = null;
    this.repHistory = []; // Track form per rep
    this._repFormIssues = []; // Issues detected during current rep
    this._angleHistory = []; // Smoothing buffer
  }

  /**
   * Process a new frame of keypoints and return updated state.
   *
   * @param {Array<{x: number, y: number, score: number}>} keypoints
   * @param {object} classifierOutput — from formClassifier.classify()
   * @returns {{ repCount, state, angle, formScore, cue, formIssues }}
   */
  update(keypoints, classifierOutput = null) {
    if (!keypoints || keypoints.length < 17) {
      return this._getState();
    }

    // Compute primary angle for this exercise
    const rawAngle = this.config.primaryAngle(keypoints);
    
    // Smooth the angle (average of last 3 frames)
    this._angleHistory.push(rawAngle);
    if (this._angleHistory.length > 3) this._angleHistory.shift();
    this.currentAngle = this._angleHistory.reduce((a, b) => a + b, 0) / this._angleHistory.length;

    const { DOWN_THRESHOLD, UP_THRESHOLD } = this.config.phases;

// State machine transitions
    // Each state gets its own case to avoid fall-through bugs
    const prevState = this.state;

    switch (this.state) {
      case REP_STATES.IDLE:
        // Detect starting position
        if (this.currentAngle > UP_THRESHOLD) {
          this.state = REP_STATES.AT_TOP;
        } else if (this.currentAngle < DOWN_THRESHOLD) {
          this.state = REP_STATES.AT_BOTTOM;
        }
        break;

      case REP_STATES.AT_TOP:
        // From top position, detect descent
        if (this.currentAngle < DOWN_THRESHOLD) {
          this.state = REP_STATES.AT_BOTTOM;
          this._repFormIssues = [];
        } else if (this.currentAngle < UP_THRESHOLD) {
          this.state = REP_STATES.GOING_DOWN;
          this._repFormIssues = [];
        }
        break;

      case REP_STATES.GOING_DOWN:
        // Descending — wait for bottom
        if (this.currentAngle < DOWN_THRESHOLD) {
          this.state = REP_STATES.AT_BOTTOM;
        } else if (this.currentAngle > UP_THRESHOLD) {
          // Went back up without reaching bottom (partial rep)
          this.state = REP_STATES.AT_TOP;
        }
        break;

      case REP_STATES.AT_BOTTOM:
        // From bottom, detect ascent
        if (this.currentAngle > UP_THRESHOLD) {
          // Full rep completed!
          this.state = REP_STATES.AT_TOP;
          this.repCount++;
          this._recordRep();
        } else if (this.currentAngle > DOWN_THRESHOLD) {
          this.state = REP_STATES.GOING_UP;
        }
        break;

      case REP_STATES.GOING_UP:
        // Ascending — wait for top to count the rep
        if (this.currentAngle > UP_THRESHOLD) {
          // Full rep completed!
          this.state = REP_STATES.AT_TOP;
          this.repCount++;
          this._recordRep();
        } else if (this.currentAngle < DOWN_THRESHOLD) {
          // Went back down without reaching top
          this.state = REP_STATES.AT_BOTTOM;
        }
        break;
    }

    // Debug logging (throttled to ~1 per second)
    if (!this._lastLogTime || Date.now() - this._lastLogTime > 1000) {
      console.log(`[RepCounter] ${this.exerciseName} | angle: ${Math.round(this.currentAngle)}° | state: ${prevState}→${this.state} | reps: ${this.repCount} | thresholds: DOWN<${DOWN_THRESHOLD} UP>${UP_THRESHOLD}`);
      this._lastLogTime = Date.now();
    }

// Form checks
    this.formIssues = [];
    const now = Date.now();

    for (const check of this.config.formChecks) {
      const isBad = check.check(keypoints, this.prevKeypoints);
      if (isBad) {
        this.formIssues.push(check);
        this._repFormIssues.push(check.id);

        // Rate-limit cue display (1 cue per 2 seconds max)
        if (now - this.lastCueTime > 2000) {
          this.currentCue = {
            text: check.cue,
            severity: check.severity,
            timestamp: now,
          };
          this.lastCueTime = now;
        }
      }
    }

    // Good form cue when no issues
    if (this.formIssues.length === 0 && this.state !== REP_STATES.IDLE) {
      if (now - this.lastCueTime > 3000) {
        this.currentCue = {
          text: this.config.goodCue,
          severity: 'good',
          timestamp: now,
        };
        this.lastCueTime = now;
      }
    }

    // Clear stale cues (after 2.5 seconds)
    if (this.currentCue && now - this.currentCue.timestamp > 2500) {
      this.currentCue = null;
    }

    // Compute form score (0-100)
    const issueCount = this.formIssues.length;
    const maxIssues = this.config.formChecks.length;
    this.formScore = Math.round(((maxIssues - issueCount) / maxIssues) * 100);

    // Store for next frame's velocity calculations
    this.prevKeypoints = keypoints;

    return this._getState();
  }

  /**
   * Record a completed rep with its form quality.
   */
  _recordRep() {
    const uniqueIssues = [...new Set(this._repFormIssues)];
    const repQuality = uniqueIssues.length === 0 ? 'perfect' :
                       uniqueIssues.length <= 1 ? 'good' : 'needs_work';
    
    this.repHistory.push({
      rep: this.repCount,
      quality: repQuality,
      issues: uniqueIssues,
      timestamp: Date.now(),
    });

    this._repFormIssues = [];
  }

  /**
   * Get the current state as a plain object.
   */
  _getState() {
    return {
      repCount: this.repCount,
      state: this.state,
      angle: Math.round(this.currentAngle),
      formScore: this.formScore,
      cue: this.currentCue,
      formIssues: this.formIssues,
      repHistory: this.repHistory,
    };
  }

  /**
   * Reset the counter.
   */
  reset() {
    this.state = REP_STATES.IDLE;
    this.repCount = 0;
    this.currentAngle = 0;
    this.formIssues = [];
    this.formScore = 100;
    this.currentCue = null;
    this.prevKeypoints = null;
    this.repHistory = [];
    this._repFormIssues = [];
    this._angleHistory = [];
  }
}
