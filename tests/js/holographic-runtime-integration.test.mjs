import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHolographicCanvaPayload,
  TARGETS,
  validateHolographicCanvaPayload,
} from 'canva-depth-archive-tooling';
import {
  buildHolographicOperatorView,
  validateHolographicOperatorView,
} from 'canva-depth-archive-tooling/holographic-operator-view';

const scene = {
  sceneVersion: 2,
  sceneId: 'thergrid-scene-runtime-001',
  snapshotId: 'snapshot-runtime-001',
  rendererContract: { mode: 'renderer-neutral', authoritativeSource: 'thergrid-decision-receipt' },
  layers: [
    { id: 'topology', type: 'topology', data: { nodes: 3 } },
    { id: 'solver-primary', type: 'solverComparison', data: [
      { id: 'classical', objective: 0.12, feasible: true, runtimeMs: 8 },
      { id: 'quantum-inspired', objective: 0.09, feasible: true, runtimeMs: 14 },
    ] },
  ],
  attention: [
    { id: 'a-low', priority: 1, severity: 'info', reason: 'Review forecast', evidenceRef: 'receipt-001', advisoryOnly: true },
    { id: 'a-high', priority: 3, severity: 'warning', reason: 'Review constrained candidate', evidenceRef: 'solver-002', advisoryOnly: true },
  ],
  provenanceRef: 'experiment-runtime-001',
  proposal: { id: 'proposal-001', status: 'advisory' },
  metrics: { balanceKw: 0, renewableShare: 0.72 },
};

test('executes deterministic THERGRID-to-VÆLON-to-Canva presentation handoff', () => {
  const payloads = TARGETS.map((target) => buildHolographicCanvaPayload({ scene, target, designId: 'design-runtime-001' }));
  for (const payload of payloads) {
    assert.equal(validateHolographicCanvaPayload(payload), true, payload.target);
    assert.equal(payload.snapshotId, scene.snapshotId);
    assert.equal(payload.sceneIdentity, scene.sceneId);
    assert.equal(payload.provenanceRef, scene.provenanceRef);
    assert.equal(payload.authoritativeSource, 'thergrid-decision-receipt');
    assert.equal(payload.safety.authoritative, false);
    assert.equal(payload.safety.physicalActuation, false);
    assert.equal(payload.safety.provenanceRequired, true);

    const view = buildHolographicOperatorView({ payload });
    assert.equal(validateHolographicOperatorView(view), true, payload.target);
    assert.equal(view.source.snapshotId, scene.snapshotId);
    assert.equal(view.source.sceneId, scene.sceneId);
    assert.equal(view.source.provenanceRef, scene.provenanceRef);
    assert.equal(view.presentation.interaction, 'presentation-only');
    assert.equal(view.presentation.authoritative, false);
    assert.equal(view.presentation.physicalActuation, false);
    assert.equal(view.comparison.candidateCount, 2);
    assert.equal(view.attention[0].priority <= view.attention[1].priority, true);
  }
});

test('fails closed when the validated handoff identity is changed after projection', () => {
  const payload = buildHolographicCanvaPayload({ scene, target: 'volumetric-3d' });
  const tampered = { ...payload, provenanceRef: 'experiment-runtime-tampered' };
  assert.equal(validateHolographicCanvaPayload(tampered), false);
  assert.throws(() => buildHolographicOperatorView({ payload: tampered }), /payload failed holographic integrity validation/);
});

test('fails closed when presentation authority is requested', () => {
  const payload = buildHolographicCanvaPayload({ scene, target: 'ar-vr' });
  const tampered = { ...payload, safety: { ...payload.safety, authoritative: true } };
  assert.equal(validateHolographicCanvaPayload(tampered), false);
});
