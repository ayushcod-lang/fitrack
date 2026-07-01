/**
 * Exercise Configuration — thresholds, phases, and form cue library
 * for all 10 supported exercises in the AI rep counter.
 *
 * Each exercise defines:
 *   - primaryJoints: which MoveNet keypoint indices to focus on
 *   - phases: { DOWN, UP } angle thresholds for the primary joint
 *   - formChecks: array of { id, label, check(features) => boolean }
 *   - cues: map from formCheck id => spoken/displayed cue string
 *   - viewAngle: 'side' | 'front' — camera orientation hint
 */

// MoveNet keypoint indices
export const KEYPOINTS = {
  NOSE: 0,
  LEFT_EYE: 1,
  RIGHT_EYE: 2,
  LEFT_EAR: 3,
  RIGHT_EAR: 4,
  LEFT_SHOULDER: 5,
  RIGHT_SHOULDER: 6,
  LEFT_ELBOW: 7,
  RIGHT_ELBOW: 8,
  LEFT_WRIST: 9,
  RIGHT_WRIST: 10,
  LEFT_HIP: 11,
  RIGHT_HIP: 12,
  LEFT_KNEE: 13,
  RIGHT_KNEE: 14,
  LEFT_ANKLE: 15,
  RIGHT_ANKLE: 16,
};

/**
 * Compute the angle (in degrees) at joint B, given three keypoints A-B-C.
 */
export function computeAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * (180 / Math.PI));
  if (angle > 180) angle = 360 - angle;
  return angle;
}

/**
 * Get the midpoint between two keypoints.
 */
export function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Per-exercise configuration
 */
export const EXERCISE_CONFIGS = {
  'Barbell Squat': {
    viewAngle: 'side',
    primaryAngle: (kp) => {
      const hip = midpoint(kp[KEYPOINTS.LEFT_HIP], kp[KEYPOINTS.RIGHT_HIP]);
      const knee = midpoint(kp[KEYPOINTS.LEFT_KNEE], kp[KEYPOINTS.RIGHT_KNEE]);
      const ankle = midpoint(kp[KEYPOINTS.LEFT_ANKLE], kp[KEYPOINTS.RIGHT_ANKLE]);
      return computeAngle(hip, knee, ankle);
    },
    phases: { DOWN_THRESHOLD: 110, UP_THRESHOLD: 145 },
    formChecks: [
      {
        id: 'knee_cave',
        label: 'Knee Cave',
        check: (kp) => {
          const lKnee = kp[KEYPOINTS.LEFT_KNEE];
          const rKnee = kp[KEYPOINTS.RIGHT_KNEE];
          const lAnkle = kp[KEYPOINTS.LEFT_ANKLE];
          const rAnkle = kp[KEYPOINTS.RIGHT_ANKLE];
          const kneeWidth = Math.abs(lKnee.x - rKnee.x);
          const ankleWidth = Math.abs(lAnkle.x - rAnkle.x);
          return kneeWidth < ankleWidth * 0.75;
        },
        cue: '⚠️ Knees caving in — push them out!',
        severity: 'warning',
      },
      {
        id: 'depth',
        label: 'Depth',
        check: (kp) => {
          const hip = midpoint(kp[KEYPOINTS.LEFT_HIP], kp[KEYPOINTS.RIGHT_HIP]);
          const knee = midpoint(kp[KEYPOINTS.LEFT_KNEE], kp[KEYPOINTS.RIGHT_KNEE]);
          return hip.y < knee.y - 0.02;
        },
        cue: '⬇️ Go deeper — hips below knees!',
        severity: 'info',
      },
      {
        id: 'forward_lean',
        label: 'Forward Lean',
        check: (kp) => {
          const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
          const hip = midpoint(kp[KEYPOINTS.LEFT_HIP], kp[KEYPOINTS.RIGHT_HIP]);
          const torsoAngle = Math.atan2(shoulder.y - hip.y, shoulder.x - hip.x) * (180 / Math.PI);
          return Math.abs(torsoAngle + 90) > 35;
        },
        cue: '🔼 Keep your chest up!',
        severity: 'warning',
      },
    ],
    goodCue: '✅ Great squat form!',
  },

  'Deadlift': {
    viewAngle: 'side',
    primaryAngle: (kp) => {
      const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
      const hip = midpoint(kp[KEYPOINTS.LEFT_HIP], kp[KEYPOINTS.RIGHT_HIP]);
      const knee = midpoint(kp[KEYPOINTS.LEFT_KNEE], kp[KEYPOINTS.RIGHT_KNEE]);
      return computeAngle(shoulder, hip, knee);
    },
    phases: { DOWN_THRESHOLD: 110, UP_THRESHOLD: 150 },
    formChecks: [
      {
        id: 'back_rounding',
        label: 'Back Rounding',
        check: (kp) => {
          const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
          const hip = midpoint(kp[KEYPOINTS.LEFT_HIP], kp[KEYPOINTS.RIGHT_HIP]);
          const midBack = midpoint(shoulder, hip);
          const expectedMidY = (shoulder.y + hip.y) / 2;
          return midBack.y > expectedMidY + 0.03;
        },
        cue: '⚠️ Keep your back flat — don\'t round!',
        severity: 'error',
      },
      {
        id: 'lockout',
        label: 'Lockout',
        check: (kp) => {
          const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
          const hip = midpoint(kp[KEYPOINTS.LEFT_HIP], kp[KEYPOINTS.RIGHT_HIP]);
          const knee = midpoint(kp[KEYPOINTS.LEFT_KNEE], kp[KEYPOINTS.RIGHT_KNEE]);
          const angle = computeAngle(shoulder, hip, knee);
          return angle > 160 && angle < 175;
        },
        cue: '🔒 Drive your hips through at the top!',
        severity: 'info',
      },
    ],
    goodCue: '✅ Strong deadlift!',
  },

  'Bench Press': {
    viewAngle: 'side',
    primaryAngle: (kp) => {
      const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
      const elbow = midpoint(kp[KEYPOINTS.LEFT_ELBOW], kp[KEYPOINTS.RIGHT_ELBOW]);
      const wrist = midpoint(kp[KEYPOINTS.LEFT_WRIST], kp[KEYPOINTS.RIGHT_WRIST]);
      return computeAngle(shoulder, elbow, wrist);
    },
    phases: { DOWN_THRESHOLD: 100, UP_THRESHOLD: 150 },
    formChecks: [
      {
        id: 'elbow_flare',
        label: 'Elbow Flare',
        check: (kp) => {
          const lElbow = kp[KEYPOINTS.LEFT_ELBOW];
          const rElbow = kp[KEYPOINTS.RIGHT_ELBOW];
          const lShoulder = kp[KEYPOINTS.LEFT_SHOULDER];
          const rShoulder = kp[KEYPOINTS.RIGHT_SHOULDER];
          const elbowWidth = Math.abs(lElbow.x - rElbow.x);
          const shoulderWidth = Math.abs(lShoulder.x - rShoulder.x);
          return elbowWidth > shoulderWidth * 1.5;
        },
        cue: '⚠️ Tuck your elbows in!',
        severity: 'warning',
      },
      {
        id: 'lockout',
        label: 'Full Lockout',
        check: (kp) => {
          const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
          const elbow = midpoint(kp[KEYPOINTS.LEFT_ELBOW], kp[KEYPOINTS.RIGHT_ELBOW]);
          const wrist = midpoint(kp[KEYPOINTS.LEFT_WRIST], kp[KEYPOINTS.RIGHT_WRIST]);
          const angle = computeAngle(shoulder, elbow, wrist);
          return angle > 150 && angle < 165;
        },
        cue: '🔒 Full lockout at the top!',
        severity: 'info',
      },
    ],
    goodCue: '✅ Solid press!',
  },

  'Dumbbell Curl': {
    viewAngle: 'front',
    primaryAngle: (kp) => {
      const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
      const elbow = midpoint(kp[KEYPOINTS.LEFT_ELBOW], kp[KEYPOINTS.RIGHT_ELBOW]);
      const wrist = midpoint(kp[KEYPOINTS.LEFT_WRIST], kp[KEYPOINTS.RIGHT_WRIST]);
      return computeAngle(shoulder, elbow, wrist);
    },
    phases: { DOWN_THRESHOLD: 60, UP_THRESHOLD: 140 },
    formChecks: [
      {
        id: 'elbow_drift',
        label: 'Elbow Drift',
        check: (kp, prevKp) => {
          if (!prevKp) return false;
          const elbow = midpoint(kp[KEYPOINTS.LEFT_ELBOW], kp[KEYPOINTS.RIGHT_ELBOW]);
          const prevElbow = midpoint(prevKp[KEYPOINTS.LEFT_ELBOW], prevKp[KEYPOINTS.RIGHT_ELBOW]);
          return Math.abs(elbow.y - prevElbow.y) > 0.05;
        },
        cue: '⚠️ Keep your elbows pinned to your sides!',
        severity: 'warning',
      },
      {
        id: 'full_extension',
        label: 'Full Extension',
        check: (kp) => {
          const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
          const elbow = midpoint(kp[KEYPOINTS.LEFT_ELBOW], kp[KEYPOINTS.RIGHT_ELBOW]);
          const wrist = midpoint(kp[KEYPOINTS.LEFT_WRIST], kp[KEYPOINTS.RIGHT_WRIST]);
          const angle = computeAngle(shoulder, elbow, wrist);
          return angle > 140 && angle < 155;
        },
        cue: '⬇️ Full extension at the bottom!',
        severity: 'info',
      },
      {
        id: 'squeeze',
        label: 'Peak Contraction',
        check: (kp) => {
          const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
          const elbow = midpoint(kp[KEYPOINTS.LEFT_ELBOW], kp[KEYPOINTS.RIGHT_ELBOW]);
          const wrist = midpoint(kp[KEYPOINTS.LEFT_WRIST], kp[KEYPOINTS.RIGHT_WRIST]);
          const angle = computeAngle(shoulder, elbow, wrist);
          return angle < 50 && angle > 35;
        },
        cue: '💪 Squeeze at the top!',
        severity: 'info',
      },
    ],
    goodCue: '✅ Perfect curl!',
  },

  'Overhead Press': {
    viewAngle: 'front',
    primaryAngle: (kp) => {
      const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
      const elbow = midpoint(kp[KEYPOINTS.LEFT_ELBOW], kp[KEYPOINTS.RIGHT_ELBOW]);
      const wrist = midpoint(kp[KEYPOINTS.LEFT_WRIST], kp[KEYPOINTS.RIGHT_WRIST]);
      return computeAngle(shoulder, elbow, wrist);
    },
    phases: { DOWN_THRESHOLD: 100, UP_THRESHOLD: 150 },
    formChecks: [
      {
        id: 'back_arch',
        label: 'Excessive Back Arch',
        check: (kp) => {
          const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
          const hip = midpoint(kp[KEYPOINTS.LEFT_HIP], kp[KEYPOINTS.RIGHT_HIP]);
          const lean = Math.atan2(shoulder.x - hip.x, hip.y - shoulder.y) * (180 / Math.PI);
          return Math.abs(lean) > 15;
        },
        cue: '⚠️ Don\'t lean back — keep your core tight!',
        severity: 'warning',
      },
      {
        id: 'lockout',
        label: 'Lockout',
        check: (kp) => {
          const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
          const elbow = midpoint(kp[KEYPOINTS.LEFT_ELBOW], kp[KEYPOINTS.RIGHT_ELBOW]);
          const wrist = midpoint(kp[KEYPOINTS.LEFT_WRIST], kp[KEYPOINTS.RIGHT_WRIST]);
          const angle = computeAngle(shoulder, elbow, wrist);
          return angle > 155 && angle < 170;
        },
        cue: '🔒 Lock out at the top!',
        severity: 'info',
      },
    ],
    goodCue: '✅ Great press!',
  },

  'Pull-ups': {
    viewAngle: 'front',
    primaryAngle: (kp) => {
      const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
      const elbow = midpoint(kp[KEYPOINTS.LEFT_ELBOW], kp[KEYPOINTS.RIGHT_ELBOW]);
      const wrist = midpoint(kp[KEYPOINTS.LEFT_WRIST], kp[KEYPOINTS.RIGHT_WRIST]);
      return computeAngle(shoulder, elbow, wrist);
    },
    phases: { DOWN_THRESHOLD: 70, UP_THRESHOLD: 140 },
    formChecks: [
      {
        id: 'chin_over_bar',
        label: 'Chin Over Bar',
        check: (kp) => {
          const nose = kp[KEYPOINTS.NOSE];
          const wrist = midpoint(kp[KEYPOINTS.LEFT_WRIST], kp[KEYPOINTS.RIGHT_WRIST]);
          return nose.y > wrist.y + 0.03;
        },
        cue: '⬆️ Get your chin over the bar!',
        severity: 'info',
      },
      {
        id: 'kipping',
        label: 'Kipping',
        check: (kp, prevKp) => {
          if (!prevKp) return false;
          const hip = midpoint(kp[KEYPOINTS.LEFT_HIP], kp[KEYPOINTS.RIGHT_HIP]);
          const prevHip = midpoint(prevKp[KEYPOINTS.LEFT_HIP], prevKp[KEYPOINTS.RIGHT_HIP]);
          return Math.abs(hip.x - prevHip.x) > 0.06;
        },
        cue: '⚠️ No kipping — strict form!',
        severity: 'warning',
      },
      {
        id: 'full_hang',
        label: 'Full Dead Hang',
        check: (kp) => {
          const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
          const elbow = midpoint(kp[KEYPOINTS.LEFT_ELBOW], kp[KEYPOINTS.RIGHT_ELBOW]);
          const wrist = midpoint(kp[KEYPOINTS.LEFT_WRIST], kp[KEYPOINTS.RIGHT_WRIST]);
          const angle = computeAngle(shoulder, elbow, wrist);
          return angle > 140 && angle < 155;
        },
        cue: '⬇️ Go all the way down — full extension!',
        severity: 'info',
      },
    ],
    goodCue: '✅ Strong pull-up!',
  },

  'Push-ups': {
    viewAngle: 'side',
    primaryAngle: (kp) => {
      const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
      const elbow = midpoint(kp[KEYPOINTS.LEFT_ELBOW], kp[KEYPOINTS.RIGHT_ELBOW]);
      const wrist = midpoint(kp[KEYPOINTS.LEFT_WRIST], kp[KEYPOINTS.RIGHT_WRIST]);
      return computeAngle(shoulder, elbow, wrist);
    },
    phases: { DOWN_THRESHOLD: 100, UP_THRESHOLD: 150 },
    formChecks: [
      {
        id: 'hip_sag',
        label: 'Hip Sag',
        check: (kp) => {
          const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
          const hip = midpoint(kp[KEYPOINTS.LEFT_HIP], kp[KEYPOINTS.RIGHT_HIP]);
          const ankle = midpoint(kp[KEYPOINTS.LEFT_ANKLE], kp[KEYPOINTS.RIGHT_ANKLE]);
          const bodyAngle = computeAngle(shoulder, hip, ankle);
          return bodyAngle < 160;
        },
        cue: '⚠️ Keep your hips level — don\'t sag!',
        severity: 'warning',
      },
      {
        id: 'hip_pike',
        label: 'Hip Pike',
        check: (kp) => {
          const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
          const hip = midpoint(kp[KEYPOINTS.LEFT_HIP], kp[KEYPOINTS.RIGHT_HIP]);
          const ankle = midpoint(kp[KEYPOINTS.LEFT_ANKLE], kp[KEYPOINTS.RIGHT_ANKLE]);
          const bodyAngle = computeAngle(shoulder, hip, ankle);
          return bodyAngle > 195;
        },
        cue: '⬇️ Flatten your body — hips too high!',
        severity: 'warning',
      },
      {
        id: 'depth',
        label: 'Depth',
        check: (kp) => {
          const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
          const elbow = midpoint(kp[KEYPOINTS.LEFT_ELBOW], kp[KEYPOINTS.RIGHT_ELBOW]);
          const wrist = midpoint(kp[KEYPOINTS.LEFT_WRIST], kp[KEYPOINTS.RIGHT_WRIST]);
          const angle = computeAngle(shoulder, elbow, wrist);
          return angle > 85 && angle < 100;
        },
        cue: '⬇️ Go deeper — chest must touch!',
        severity: 'info',
      },
    ],
    goodCue: '✅ Perfect push-up!',
  },

  'Leg Press': {
    viewAngle: 'side',
    primaryAngle: (kp) => {
      const hip = midpoint(kp[KEYPOINTS.LEFT_HIP], kp[KEYPOINTS.RIGHT_HIP]);
      const knee = midpoint(kp[KEYPOINTS.LEFT_KNEE], kp[KEYPOINTS.RIGHT_KNEE]);
      const ankle = midpoint(kp[KEYPOINTS.LEFT_ANKLE], kp[KEYPOINTS.RIGHT_ANKLE]);
      return computeAngle(hip, knee, ankle);
    },
    phases: { DOWN_THRESHOLD: 100, UP_THRESHOLD: 145 },
    formChecks: [
      {
        id: 'depth',
        label: 'Depth',
        check: (kp) => {
          const hip = midpoint(kp[KEYPOINTS.LEFT_HIP], kp[KEYPOINTS.RIGHT_HIP]);
          const knee = midpoint(kp[KEYPOINTS.LEFT_KNEE], kp[KEYPOINTS.RIGHT_KNEE]);
          const ankle = midpoint(kp[KEYPOINTS.LEFT_ANKLE], kp[KEYPOINTS.RIGHT_ANKLE]);
          const angle = computeAngle(hip, knee, ankle);
          return angle > 85 && angle < 100;
        },
        cue: '⬇️ Go deeper!',
        severity: 'info',
      },
      {
        id: 'knee_tracking',
        label: 'Knee Tracking',
        check: (kp) => {
          const lKnee = kp[KEYPOINTS.LEFT_KNEE];
          const rKnee = kp[KEYPOINTS.RIGHT_KNEE];
          const lAnkle = kp[KEYPOINTS.LEFT_ANKLE];
          const rAnkle = kp[KEYPOINTS.RIGHT_ANKLE];
          const kneeWidth = Math.abs(lKnee.x - rKnee.x);
          const ankleWidth = Math.abs(lAnkle.x - rAnkle.x);
          return kneeWidth < ankleWidth * 0.7;
        },
        cue: '⚠️ Knees tracking your toes!',
        severity: 'warning',
      },
    ],
    goodCue: '✅ Great leg press!',
  },

  'Romanian Deadlift': {
    viewAngle: 'side',
    primaryAngle: (kp) => {
      const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
      const hip = midpoint(kp[KEYPOINTS.LEFT_HIP], kp[KEYPOINTS.RIGHT_HIP]);
      const knee = midpoint(kp[KEYPOINTS.LEFT_KNEE], kp[KEYPOINTS.RIGHT_KNEE]);
      return computeAngle(shoulder, hip, knee);
    },
    phases: { DOWN_THRESHOLD: 110, UP_THRESHOLD: 150 },
    formChecks: [
      {
        id: 'back_flat',
        label: 'Back Flatness',
        check: (kp) => {
          const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
          const hip = midpoint(kp[KEYPOINTS.LEFT_HIP], kp[KEYPOINTS.RIGHT_HIP]);
          const midBack = midpoint(shoulder, hip);
          const expectedMidY = (shoulder.y + hip.y) / 2;
          return midBack.y > expectedMidY + 0.03;
        },
        cue: '⚠️ Keep your back flat!',
        severity: 'error',
      },
      {
        id: 'knee_softness',
        label: 'Knee Bend',
        check: (kp) => {
          const hip = midpoint(kp[KEYPOINTS.LEFT_HIP], kp[KEYPOINTS.RIGHT_HIP]);
          const knee = midpoint(kp[KEYPOINTS.LEFT_KNEE], kp[KEYPOINTS.RIGHT_KNEE]);
          const ankle = midpoint(kp[KEYPOINTS.LEFT_ANKLE], kp[KEYPOINTS.RIGHT_ANKLE]);
          const kneeAngle = computeAngle(hip, knee, ankle);
          return kneeAngle > 175;
        },
        cue: '🦵 Slight bend in the knees — don\'t lock out!',
        severity: 'info',
      },
      {
        id: 'hip_hinge',
        label: 'Hip Hinge',
        check: (kp) => {
          const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
          const hip = midpoint(kp[KEYPOINTS.LEFT_HIP], kp[KEYPOINTS.RIGHT_HIP]);
          return shoulder.x - hip.x < 0.02;
        },
        cue: '⬅️ Push your hips back more!',
        severity: 'info',
      },
    ],
    goodCue: '✅ Great RDL!',
  },

  'Lateral Raise': {
    viewAngle: 'front',
    primaryAngle: (kp) => {
      const hip = midpoint(kp[KEYPOINTS.LEFT_HIP], kp[KEYPOINTS.RIGHT_HIP]);
      const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
      const elbow = midpoint(kp[KEYPOINTS.LEFT_ELBOW], kp[KEYPOINTS.RIGHT_ELBOW]);
      return computeAngle(hip, shoulder, elbow);
    },
    phases: { DOWN_THRESHOLD: 25, UP_THRESHOLD: 65 },
    formChecks: [
      {
        id: 'height',
        label: 'Arm Height',
        check: (kp) => {
          const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
          const elbow = midpoint(kp[KEYPOINTS.LEFT_ELBOW], kp[KEYPOINTS.RIGHT_ELBOW]);
          return elbow.y > shoulder.y + 0.03;
        },
        cue: '⬆️ Raise to shoulder level!',
        severity: 'info',
      },
      {
        id: 'momentum',
        label: 'Momentum/Swing',
        check: (kp, prevKp) => {
          if (!prevKp) return false;
          const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
          const prevShoulder = midpoint(prevKp[KEYPOINTS.LEFT_SHOULDER], prevKp[KEYPOINTS.RIGHT_SHOULDER]);
          return Math.abs(shoulder.y - prevShoulder.y) > 0.04;
        },
        cue: '⚠️ No swinging — controlled movement!',
        severity: 'warning',
      },
      {
        id: 'shrug',
        label: 'Shoulder Shrug',
        check: (kp) => {
          const shoulder = midpoint(kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.RIGHT_SHOULDER]);
          const ear = midpoint(kp[KEYPOINTS.LEFT_EAR], kp[KEYPOINTS.RIGHT_EAR]);
          return (ear.y - shoulder.y) < 0.06;
        },
        cue: '⚠️ Don\'t shrug — keep shoulders down!',
        severity: 'warning',
      },
    ],
    goodCue: '✅ Perfect lateral raise!',
  },
};

/**
 * Returns the config for a given exercise name.
 * Falls back to a generic squat-like config if not found.
 */
export function getExerciseConfig(exerciseName) {
  return EXERCISE_CONFIGS[exerciseName] || EXERCISE_CONFIGS['Barbell Squat'];
}

/**
 * List of supported exercises for the auto-tracking feature.
 */
export const SUPPORTED_EXERCISES = Object.keys(EXERCISE_CONFIGS);
