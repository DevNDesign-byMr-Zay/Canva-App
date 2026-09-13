import test from 'node:test';
import assert from 'node:assert/strict';
import { compileAiHolographicScene } from '../../src/ai-holographic-scene.mjs';
import { validateHolographicCanvaPayload } from '../../src/holographic-scene-adapter.mjs';
import { buildHolographicOperatorView, validateHolographicOperatorView } from '../../src/holographic-operator-view.mjs';

const modelOutput = {
  intentVersion: 1,
  sceneId: 'canva-scene-001',
  intent: 'Turn the poster into a floating presentation',
  target: 'volumetric-3d',
  nodes: [{ id: 'title', kind: 'text', role: 'headline', canvaElementId: 'element-title', x: 1, y: 2, z: 3, style: { emphasis: 'high' }, animation: { mode: 'float', durationMs: 1200, loop: true }, interaction: { action: 'focus', target: 'title' } }],
  attention: [{ priority: 1, severity: 'info', reason: 'Primary title', evidenceRef: 'design-receipt-001' }],
};

function compilePayload() {
  return compileAiHolographicScene({ modelOutput, snapshotId: 'snapshot-001', provenanceRef: 'design-receipt-001', designId: 'canva-design-001' });
}

test('compiles structured AI output into an integrity-protected Canva payload', () => {
  const payload = compilePayload();
  const node = payload.layers[0].data[0];
  assert.equal(payload.target, 'volumetric-3d');
  assert.equal(payload.designId, 'canva-design-001');
  assert.equal(node.position.z, 3);
  assert.equal(node.role, 'headline');
  assert.equal(node.canvaElementId, 'element-title');
  assert.equal(node.animation.mode, 'float');
  assert.equal(node.interaction.action, 'focus');
  assert.equal(payload.attention[0].advisoryOnly, true);
  assert.equal(payload.safety.physicalActuation, false);
  assert.equal(validateHolographicCanvaPayload(payload), true);
});

test('round-trips AI scene through the operator advisory view', () => {
  const payload = compilePayload();
  const view = buildHolographicOperatorView({ payload });
  assert.equal(view.target, 'volumetric-3d');
  assert.equal(view.source.sceneId, 'canva-scene-001');
  assert.equal(view.source.snapshotId, 'snapshot-001');
  assert.equal(view.source.provenanceRef, 'design-receipt-001');
  assert.equal(view.attention[0].advisoryOnly, true);
  assert.equal(view.presentation.authoritative, false);
  assert.equal(view.presentation.physicalActuation, false);
  assert.equal(validateHolographicOperatorView(view), true);
});

test('rejects unsupported AI-selected targets', () => {
  assert.throws(() => compileAiHolographicScene({ modelOutput: { ...modelOutput, target: 'laser-wall' }, snapshotId: 'snapshot-001', provenanceRef: 'receipt-001' }), /unsupported holographic target/);
});

test('rejects malformed animation semantics', () => {
  assert.throws(() => compileAiHolographicScene({ modelOutput: { ...modelOutput, nodes: [{ ...modelOutput.nodes[0], animation: { mode: 'float', durationMs: -1 } }] }, snapshotId: 'snapshot-001', provenanceRef: 'receipt-001' }), /durationMs/);
});

test('rejects malformed interaction semantics', () => {
  assert.throws(() => compileAiHolographicScene({ modelOutput: { ...modelOutput, nodes: [{ ...modelOutput.nodes[0], interaction: { action: '' } }] }, snapshotId: 'snapshot-001', provenanceRef: 'receipt-001' }), /interaction.action/);
});
