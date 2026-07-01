/**
 * voiceCoach.js — Web Speech API wrapper for real-time voice coaching
 *
 * Uses the browser's built-in speech synthesis to announce:
 *   - Rep counts ("Rep 5!")
 *   - Form cues ("Go deeper", "Keep your back straight")
 *   - Encouragement ("Great form!", "You're on fire!")
 *   - Phase transitions ("Going up", "Hold at the bottom")
 *
 * Features:
 *   - Rate-limited to avoid overlapping speech
 *   - Queue system for sequential announcements
 *   - Enable/disable toggle support
 *   - Voice selection (prefers female English voice)
 */

class VoiceCoach {
  constructor() {
    this.enabled = false;
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.voice = null;
    this.lastSpokenTime = 0;
    this.minInterval = 3000; // Minimum ms between announcements
    this.lastRepAnnounced = 0;
    this.lastCueText = '';
    this._voiceLoaded = false;

    // Pre-load voices
    if (this.synth) {
      this._loadVoice();
      // Chrome requires waiting for voiceschanged event
      this.synth.onvoiceschanged = () => this._loadVoice();
    }
  }

  /**
   * Select the best available voice (prefer English, female)
   */
  _loadVoice() {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    if (voices.length === 0) return;

    // Priority: Google US English female > any English female > any English > default
    this.voice =
      voices.find(v => v.name.includes('Google US English') && v.name.includes('Female')) ||
      voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) ||
      voices.find(v => v.lang.startsWith('en-US')) ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0];

    this._voiceLoaded = true;
  }

  /**
   * Enable or disable voice coaching
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled && this.synth) {
      this.synth.cancel(); // Stop any current speech
    }
  }

  /**
   * Check if speech synthesis is supported
   */
  isSupported() {
    return !!this.synth;
  }

  /**
   * Speak a text string (rate-limited)
   */
  _speak(text, priority = 'normal') {
    if (!this.enabled || !this.synth) return;

    const now = Date.now();
    const interval = priority === 'high' ? 1500 : this.minInterval;

    if (now - this.lastSpokenTime < interval) return;

    // Cancel any pending speech for high-priority messages
    if (priority === 'high') {
      this.synth.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1; // Slightly faster than normal
    utterance.pitch = 1.0;
    utterance.volume = 0.8;
    if (this.voice) utterance.voice = this.voice;

    this.synth.speak(utterance);
    this.lastSpokenTime = now;
  }

  /**
   * Announce a new rep count
   */
  announceRep(repCount) {
    if (repCount <= this.lastRepAnnounced) return;
    this.lastRepAnnounced = repCount;

    // Milestone announcements
    if (repCount % 10 === 0) {
      this._speak(`${repCount} reps! Amazing!`, 'high');
    } else if (repCount === 5) {
      this._speak('5 reps, keep going!', 'high');
    } else {
      this._speak(`${repCount}`, 'high');
    }
  }

  /**
   * Announce a form cue (rate-limited to avoid repetition)
   */
  announceCue(cue) {
    if (!cue || cue.text === this.lastCueText) return;
    this.lastCueText = cue.text;

    if (cue.severity === 'good') {
      // Encouraging cues
      this._speak(cue.text, 'normal');
    } else {
      // Corrective cues — higher priority
      this._speak(cue.text, 'high');
    }
  }

  /**
   * Announce phase transition
   */
  announcePhase(phase, prevPhase) {
    if (phase === prevPhase) return;

    switch (phase) {
      case 'AT_BOTTOM':
        this._speak('Push up!', 'normal');
        break;
      case 'AT_TOP':
        if (prevPhase === 'GOING_UP') {
          // Rep just completed — handled by announceRep
        }
        break;
    }
  }

  /**
   * Announce session start
   */
  announceStart(exerciseName) {
    this._speak(`Starting ${exerciseName}. Get ready!`, 'high');
  }

  /**
   * Announce session end
   */
  announceEnd(repCount) {
    this._speak(`Great work! You completed ${repCount} reps.`, 'high');
  }

  /**
   * Reset state for a new exercise set
   */
  reset() {
    this.lastRepAnnounced = 0;
    this.lastCueText = '';
    this.lastSpokenTime = 0;
    if (this.synth) this.synth.cancel();
  }

  /**
   * Clean up
   */
  dispose() {
    if (this.synth) {
      this.synth.cancel();
    }
  }
}

// Singleton instance
export const voiceCoach = new VoiceCoach();
