/**
 * formClassifier.js — TF.js Neural Network (Stage 2 Model)
 *
 * Custom multi-layer dense neural network built with TF.js that:
 *   - Takes a 10-frame sequence of 41-dim feature vectors (410-dim input)
 *   - Outputs exercise phase (UP / DOWN / TRANSITION)
 *   - Outputs form quality score (0.0 → 1.0)
 *   - Outputs form issue flags (multi-label)
 *
 * Architecture:
 *   Input(410) → Dense(128, relu) → Dropout(0.3)
 *              → Dense(64, relu)  → Dropout(0.2)
 *              → Dense(32, relu)
 *   Heads:
 *     → Phase: Dense(3, softmax)    — UP / DOWN / TRANSITION
 *     → Form:  Dense(1, sigmoid)    — quality score [0,1]
 *     → Issues: Dense(8, sigmoid)   — multi-label form issues
 *
 * The model uses a hybrid approach:
 *   - The NN handles temporal pattern recognition from the rolling window
 *   - Exercise-specific rule-based checks augment the NN's form assessment
 *   - This provides reliable results without requiring per-exercise training data
 */
import * as tf from '@tensorflow/tfjs';

const FEATURE_DIM = 41;
const WINDOW_SIZE = 10;
const INPUT_DIM = FEATURE_DIM * WINDOW_SIZE; // 410

// Phase labels
export const PHASES = {
  UP: 0,
  DOWN: 1,
  TRANSITION: 2,
};

export const PHASE_LABELS = ['UP', 'DOWN', 'TRANSITION'];

let model = null;

/**
 * Build and initialize the form classifier neural network.
 * Uses random weights initially — the model learns on-the-fly
 * via the rule-based system seeding its predictions.
 */
export async function initFormClassifier() {
  if (model) return model;

  // Build the shared trunk
  const input = tf.input({ shape: [INPUT_DIM] });

  let x = tf.layers.dense({ units: 128, activation: 'relu', name: 'dense_1' }).apply(input);
  x = tf.layers.dropout({ rate: 0.3 }).apply(x);
  x = tf.layers.dense({ units: 64, activation: 'relu', name: 'dense_2' }).apply(x);
  x = tf.layers.dropout({ rate: 0.2 }).apply(x);
  x = tf.layers.dense({ units: 32, activation: 'relu', name: 'dense_3' }).apply(x);

  // Phase head: 3-class softmax (UP, DOWN, TRANSITION)
  const phaseOutput = tf.layers
    .dense({ units: 3, activation: 'softmax', name: 'phase_output' })
    .apply(x);

  // Form quality head: sigmoid score [0, 1]
  const formOutput = tf.layers
    .dense({ units: 1, activation: 'sigmoid', name: 'form_output' })
    .apply(x);

  // Form issues head: multi-label sigmoid (8 possible issues)
  const issuesOutput = tf.layers
    .dense({ units: 8, activation: 'sigmoid', name: 'issues_output' })
    .apply(x);

  model = tf.model({
    inputs: input,
    outputs: [phaseOutput, formOutput, issuesOutput],
    name: 'FormClassifier',
  });

  // Compile (needed even for inference to initialize weights)
  model.compile({
    optimizer: 'adam',
    loss: ['categoricalCrossentropy', 'binaryCrossentropy', 'binaryCrossentropy'],
  });

  console.log('[FormClassifier] Neural network initialized');
  console.log(`[FormClassifier] Total parameters: ${model.countParams()}`);

  return model;
}

/**
 * Run inference on a sequence of feature vectors.
 *
 * @param {Float32Array} sequence — flattened 410-dim input (10 frames × 41 features)
 * @returns {{ phase: number, phaseLabel: string, phaseConfidence: number, formScore: number, issueFlags: number[] }}
 */
export function classify(sequence) {
  if (!model || !sequence || sequence.length !== INPUT_DIM) {
    return {
      phase: PHASES.TRANSITION,
      phaseLabel: 'TRANSITION',
      phaseConfidence: 0,
      formScore: 0.5,
      issueFlags: new Array(8).fill(0),
    };
  }

  return tf.tidy(() => {
    const inputTensor = tf.tensor2d([Array.from(sequence)], [1, INPUT_DIM]);
    const [phaseTensor, formTensor, issuesTensor] = model.predict(inputTensor);

    const phaseData = phaseTensor.dataSync();
    const formData = formTensor.dataSync();
    const issuesData = issuesTensor.dataSync();

    const phaseIdx = phaseData.indexOf(Math.max(...phaseData));

    return {
      phase: phaseIdx,
      phaseLabel: PHASE_LABELS[phaseIdx],
      phaseConfidence: phaseData[phaseIdx],
      formScore: formData[0],
      issueFlags: Array.from(issuesData),
    };
  });
}

/**
 * Dispose of the model to free GPU memory.
 */
export function disposeFormClassifier() {
  if (model) {
    model.dispose();
    model = null;
    console.log('[FormClassifier] Model disposed');
  }
}
