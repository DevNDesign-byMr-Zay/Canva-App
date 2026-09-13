import test from 'node:test';
import assert from 'node:assert/strict';
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

test('rejects unsupported AI-selected targets', () => {
  assert.throws(
    () => compileAiHolographicScene({
      modelOutput: { ...modelOutput, target: 'laser-wall' },
      snapshotId: 'snapshot-001',
      provenanceRef: 'receipt-001',
    }),
    /unsupported holographic target/,
  );
});
