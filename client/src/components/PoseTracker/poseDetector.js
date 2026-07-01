/**
 * poseDetector.js — MoveNet Thunder loader + inference wrapper
 * 
 * Uses @tensorflow-models/pose-detection with MoveNet Thunder model.
 * MoveNet Thunder is a 29MB deep CNN that provides high-accuracy pose estimation.
 * Runs entirely in-browser via WebGL backend.
 */
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as poseDetection from '@tensorflow-models/pose-detection';

let detector = null;
let isInitializing = false;

/**
 * Initialize MoveNet Thunder detector.
 * Called once — caches the detector for subsequent frames.
 * 
 * @returns {Promise<poseDetection.PoseDetector>}
 */
export async function initPoseDetector() {
  if (detector) return detector;
  if (isInitializing) {
    // Wait for in-flight initialization
    while (isInitializing) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return detector;
  }

  isInitializing = true;

  try {
    // Ensure WebGL backend is ready
    await tf.setBackend('webgl');
    await tf.ready();

    // Create MoveNet Thunder detector (higher accuracy, ~30fps)
    detector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
        enableSmoothing: true,
        minPoseScore: 0.25,
      }
    );

    console.log('[PoseDetector] MoveNet Thunder loaded successfully');
    return detector;
  } catch (err) {
    console.error('[PoseDetector] Failed to load MoveNet Thunder:', err);
    throw err;
  } finally {
    isInitializing = false;
  }
}

/**
 * Estimate pose from a video element.
 * Returns normalized keypoints in [0, 1] range.
 * 
 * @param {HTMLVideoElement} video
 * @returns {Promise<Array<{x: number, y: number, score: number, name: string}> | null>}
 */
export async function estimatePose(video) {
  if (!detector) return null;
  if (!video || video.readyState < 2) return null;

  try {
    const poses = await detector.estimatePoses(video, {
      flipHorizontal: false,
    });

    if (!poses || poses.length === 0) return null;

    const keypoints = poses[0].keypoints;

    // Normalize coordinates to [0, 1] range based on video dimensions
    const normalized = keypoints.map((kp) => ({
      x: kp.x / video.videoWidth,
      y: kp.y / video.videoHeight,
      score: kp.score,
      name: kp.name,
    }));

    return normalized;
  } catch (err) {
    console.error('[PoseDetector] Estimation error:', err);
    return null;
  }
}

/**
 * Dispose of the detector to free memory.
 */
export async function disposePoseDetector() {
  if (detector) {
    detector.dispose();
    detector = null;
    console.log('[PoseDetector] Detector disposed');
  }
}

/**
 * Check if enough keypoints are visible with sufficient confidence.
 * Returns a visibility score 0-1.
 */
export function getVisibilityScore(keypoints) {
  if (!keypoints) return 0;
  const importantIndices = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]; // body keypoints
  const visible = importantIndices.filter((i) => keypoints[i]?.score > 0.3).length;
  return visible / importantIndices.length;
}
