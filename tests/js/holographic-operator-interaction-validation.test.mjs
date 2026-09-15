import test from 'node:test';
import assert from 'node:assert/strict';
import { compileAiHolographicScene } from '../../src/ai-holographic-scene.mjs';
import { buildHolographicOperatorView, validateHolographicOperatorView } from '../../src/holographic-operator-view.mjs';

const modelOutput = {
  intentVersion: 1,
  sceneId: 'interaction-validation-scene',
  intent: 'Inspect a design element in space',
  target: 'holo-mat',
  nodes: [{ id: 'title', kind: 'text', role: 'headline', canvaElementId: 'element-title', x: 1, y: 2, z: 0, interaction: { action: 'inspect', target: 'element-title' } }],
};

function buildView() {
  const payload = compileAiHolographicScene({
    modelOutput,
    snapshotId: 'interaction-validation-snapshot',
    provenanceRef: 'interaction-validation-receipt',
    designId: 'interaction-validation-design',
  });
  return buildHolographicOperatorView({ payload });
}

test('accepts a valid operator interaction produced from a real payload', () => {
  const view = buildView();
  assert.equal(view.interactions.length, 1);
  assert.equal(view.interactions[0].action, 'inspect');
  assert.equal(view.interactions[0].target, 'element-title');
  assert.equal(validateHolographicOperatorView(view), true);
});

test('rejects unsupported interaction actions', () => {
  const view = buildView();
  const tampered = { ...view, interactions: [{ ...view.interactions[0], action: 'execute' }] };
  assert.equal(validateHolographicOperatorView(tampered), false);
});

test('rejects empty interaction targets', () => {
  const view = buildView();
  const tampered = { ...view, interactions: [{ ...view.interactions[0], target: ' ' }] };
  assert.equal(validateHolographicOperatorView(tampered), false);
});
