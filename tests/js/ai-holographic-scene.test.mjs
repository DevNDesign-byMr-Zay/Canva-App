import assert from 'node:assert/strict';
import test from 'node:test';

import { compileAiHolographicScene } from '../../src/ai-holographic-scene.mjs';
import { validateHolographicCanvaPayload } from '../../src/holographic-scene-adapter.mjs';

const modelOutput = {
  intentVersion: 1,
  sceneId: 'canva-scene-001',
  intent: 'Turn the poster into a floating presentation',
  target: 'volumetric-3d',
  nodes: [{ id: 'title', kind: 'text', x: 1, y: 2, z: 3 }],
};

test('compiles structured AI output into an integrity-protected Canva payload', () => {
  const payload = compileAiHolographicScene({
    modelOutput,
    snapshotId: 'snapshot-001',
    provenanceRef: 'design-receipt-001',
    designId: 'canva-design-001',
  });

  assert.equal(payload.target, 'volumetric-3d');
  assert.equal(payload.designId, 'canva-design-001');
  assert.equal(payload.layers[0].type, 'topology');
  assert.equal(payload.layers[0].data[0].position.z, 3);
  assert.equal(payload.safety.physicalActuation, false);
  assert.equal(validateHolographicCanvaPayload(payload), true);
});

test('captures animation, interaction, style, and attention as immutable advisory state', () => {
  const style = { opacity: 0.8, material: { finish: 'glass' } };
  const metrics = { objectiveScore: 0.94 };
  const richOutput = {
    ...modelOutput,
    nodes: [
      {
        id: 'title',
        kind: 'text',
        x: 1,
        y: 2,
        z: 3,
        style,
        animation: { mode: 'float', durationMs: 1400, loop: true },
        interaction: { action: 'focus', target: 'details-panel' },
      },
    ],
    attention: [
      {
        priority: 1,
        severity: 'warning',
        reason: 'Review title depth before apply',
        evidenceRef: 'solver-evidence:abc123',
      },
    ],
    metrics,
  };

  const payload = compileAiHolographicScene({
    modelOutput: richOutput,
    snapshotId: 'snapshot-001',
    provenanceRef: 'design-receipt-001',
  });
  const topology = payload.layers.find((layer) => layer.type === 'topology');
  const node = topology.data[0];
  const fingerprint = payload.payloadFingerprint;

  assert.deepEqual(node.animation, { mode: 'float', durationMs: 1400, loop: true });
  assert.deepEqual(node.interaction, { action: 'focus', target: 'details-panel' });
  assert.deepEqual(payload.attention[0], {
    priority: 1,
    severity: 'warning',
    reason: 'Review title depth before apply',
    evidenceRef: 'solver-evidence:abc123',
    advisoryOnly: true,
  });
  assert.equal(Object.isFrozen(payload.layers), true);
  assert.equal(Object.isFrozen(topology.data), true);
  assert.equal(Object.isFrozen(node.style), true);
  assert.equal(Object.isFrozen(node.style.material), true);
  assert.equal(Object.isFrozen(payload.metrics), true);

  style.material.finish = 'metal';
  metrics.objectiveScore = 0.1;

  assert.equal(node.style.material.finish, 'glass');
  assert.equal(payload.metrics.objectiveScore, 0.94);
  assert.equal(payload.payloadFingerprint, fingerprint);
  assert.equal(validateHolographicCanvaPayload(payload), true);
});

test('rejects invalid animation duration and malformed interaction objects', () => {
  assert.throws(
    () =>
      compileAiHolographicScene({
        modelOutput: {
          ...modelOutput,
          nodes: [{ id: 'title', animation: { mode: 'float', durationMs: -1 } }],
        },
        snapshotId: 'snapshot-001',
        provenanceRef: 'receipt-001',
      }),
    /durationMs must be greater than or equal to zero/,
  );

  assert.throws(
    () =>
      compileAiHolographicScene({
        modelOutput: {
          ...modelOutput,
          nodes: [{ id: 'title', interaction: ['focus'] }],
        },
        snapshotId: 'snapshot-001',
        provenanceRef: 'receipt-001',
      }),
    /interaction must be an object/,
  );
});

test('rejects unsupported AI-selected targets', () => {
  assert.throws(
    () =>
      compileAiHolographicScene({
        modelOutput: { ...modelOutput, target: 'laser-wall' },
        snapshotId: 'snapshot-001',
        provenanceRef: 'receipt-001',
      }),
    /unsupported holographic target/,
  );
});
