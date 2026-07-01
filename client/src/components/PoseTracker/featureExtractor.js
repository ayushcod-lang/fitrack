/**
 * featureExtractor.js — Keypoints → 41-dimensional feature vector
 *
 * Extracts a normalized feature vector from raw MoveNet keypoints.
 * Features include:
 *   - 26 normalized joint coordinates (13 key joints × 2)
 *   - 10 joint angles (all major joints)
 *   - 1 torso-normalized scale factor
 *   - 4 keypoint confidence scores (hips + knees)
 */
import { computeAngle, KEYPOINTS } from './exerciseConfig.js';

// The 13 key joints we track (skip face keypoints except nose for reference)
const KEY_JOINT_INDICES = [
  KEYPOINTS.NOSE,
  KEYPOINTS.LEFT_SHOULDER,
  KEYPOINTS.RIGHT_SHOULDER,
  KEYPOINTS.LEFT_ELBOW,
  KEYPOINTS.RIGHT_ELBOW,
  KEYPOINTS.LEFT_WRIST,
  KEYPOINTS.RIGHT_WRIST,
  KEYPOINTS.LEFT_HIP,
  KEYPOINTS.RIGHT_HIP,
  KEYPOINTS.LEFT_KNEE,
  KEYPOINTS.RIGHT_KNEE,
  KEYPOINTS.LEFT_ANKLE,
  KEYPOINTS.RIGHT_ANKLE,
];

// Joint angle definitions: [joint A, joint B (vertex), joint C]
const ANGLE_DEFINITIONS = [
  // Left arm
  [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.LEFT_ELBOW, KEYPOINTS.LEFT_WRIST],
  // Right arm
  [KEYPOINTS.RIGHT_SHOULDER, KEYPOINTS.RIGHT_ELBOW, KEYPOINTS.RIGHT_WRIST],
  // Left shoulder
  [KEYPOINTS.LEFT_ELBOW, KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.LEFT_HIP],
  // Right shoulder
  [KEYPOINTS.RIGHT_ELBOW, KEYPOINTS.RIGHT_SHOULDER, KEYPOINTS.RIGHT_HIP],
  // Left hip
  [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.LEFT_HIP, KEYPOINTS.LEFT_KNEE],
  // Right hip
  [KEYPOINTS.RIGHT_SHOULDER, KEYPOINTS.RIGHT_HIP, KEYPOINTS.RIGHT_KNEE],
  // Left knee
  [KEYPOINTS.LEFT_HIP, KEYPOINTS.LEFT_KNEE, KEYPOINTS.LEFT_ANKLE],
  // Right knee
  [KEYPOINTS.RIGHT_HIP, KEYPOINTS.RIGHT_KNEE, KEYPOINTS.RIGHT_ANKLE],
  // Torso angle left
  [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.LEFT_HIP, KEYPOINTS.LEFT_ANKLE],
  // Torso angle right
  [KEYPOINTS.RIGHT_SHOULDER, KEYPOINTS.RIGHT_HIP, KEYPOINTS.RIGHT_ANKLE],
];

// Confidence keypoint indices (hips + knees)
const CONFIDENCE_INDICES = [
  KEYPOINTS.LEFT_HIP,
  KEYPOINTS.RIGHT_HIP,
  KEYPOINTS.LEFT_KNEE,
  KEYPOINTS.RIGHT_KNEE,
];

/**
 * Extract a 41-dimensional feature vector from keypoints.
 *
 * @param {Array<{x: number, y: number, score: number}>} keypoints — normalized [0,1]
 * @returns {Float32Array} — 41-dim feature vector
 */
export function extractFeatures(keypoints) {
  if (!keypoints || keypoints.length < 17) {
    return new Float32Array(41).fill(0);
  }

  const features = [];

// 1. Normalized joint coordinates (26 values)
  // Center on mid-hip and scale by torso length
  const midHipX = (keypoints[KEYPOINTS.LEFT_HIP].x + keypoints[KEYPOINTS.RIGHT_HIP].x) / 2;
  const midHipY = (keypoints[KEYPOINTS.LEFT_HIP].y + keypoints[KEYPOINTS.RIGHT_HIP].y) / 2;
  const midShoulderX = (keypoints[KEYPOINTS.LEFT_SHOULDER].x + keypoints[KEYPOINTS.RIGHT_SHOULDER].x) / 2;
  const midShoulderY = (keypoints[KEYPOINTS.LEFT_SHOULDER].y + keypoints[KEYPOINTS.RIGHT_SHOULDER].y) / 2;

  const torsoLength = Math.sqrt(
    Math.pow(midShoulderX - midHipX, 2) + Math.pow(midShoulderY - midHipY, 2)
  );
  const scale = torsoLength > 0.01 ? torsoLength : 0.2; // prevent division by zero

  for (const idx of KEY_JOINT_INDICES) {
    const kp = keypoints[idx];
    features.push((kp.x - midHipX) / scale);
    features.push((kp.y - midHipY) / scale);
  }

// 2. Joint angles (10 values)
  for (const [aIdx, bIdx, cIdx] of ANGLE_DEFINITIONS) {
    const angle = computeAngle(keypoints[aIdx], keypoints[bIdx], keypoints[cIdx]);
    features.push(angle / 180); // normalize to [0, 1]
  }

// 3. Torso-normalized scale (1 value)
  features.push(scale);

// 4. Confidence scores (4 values)
  for (const idx of CONFIDENCE_INDICES) {
    features.push(keypoints[idx].score || 0);
  }

  return new Float32Array(features);
}

/**
 * Maintain a rolling window of feature vectors.
 */
export class FeatureBuffer {
  constructor(windowSize = 10) {
    this.windowSize = windowSize;
    this.buffer = [];
  }

  /**
   * Add a new feature vector to the buffer.
   * @param {Float32Array} features
   */
  push(features) {
    this.buffer.push(features);
    if (this.buffer.length > this.windowSize) {
      this.buffer.shift();
    }
  }

  /**
   * Get the full sequence as a flattened Float32Array.
   * Pads with zeros if fewer than windowSize frames are available.
   * @returns {Float32Array} — shape: windowSize * 41
   */
  getSequence() {
    const featureDim = 41;
    const totalDim = this.windowSize * featureDim;
    const result = new Float32Array(totalDim);

    const offset = this.windowSize - this.buffer.length;
    for (let i = 0; i < this.buffer.length; i++) {
      result.set(this.buffer[i], (offset + i) * featureDim);
    }

    return result;
  }

  /**
   * Check if the buffer is full.
   */
  isFull() {
    return this.buffer.length >= this.windowSize;
  }

  /**
   * Clear the buffer.
   */
  reset() {
    this.buffer = [];
  }
}
