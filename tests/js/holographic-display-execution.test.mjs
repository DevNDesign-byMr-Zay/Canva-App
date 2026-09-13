import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createDisplayExecutionPlan } from '../../src/holographic/display-execution.mjs';
import { createHolographicScene } from '../../src/holographic/scene.mjs';

describe('holographic display execution planning', () => {
  const scene = createHolographicScene({
    id: 'demo',
    title: 'Demo',
    nodes: [{ id: 'hero' }],
  });

  for (const [displayProfile, target, operation, expectedPolicy] of [
    ['simulator', 'simulator', 'preview-and-replay', { deterministicReplay: true }],
    ['projector', 'projector-1', 'prepare-projector', { depth: true, perspective: true }],
    ['holomat', 'holomat-1', 'prepare-holomat', { depth: true, surfaceMapping: true }],
    [
      'three-d-platform',
      'three-d-platform-1',
      'prepare-three-d-platform',
      { depth: true, platformStaging: true },
    ],
  ]) {
    test(`maps ${displayProfile} profile to an explicit operation and render policy`, () => {
      const plan = createDisplayExecutionPlan({ scene, target, displayProfile });
      assert.equal(plan.profileId, displayProfile);
      assert.equal(plan.target, target);
      assert.equal(plan.operation, operation);
      assert.equal(plan.profileSchema, 'canva.holographic-display-profile.v1');
      assert.deepEqual(plan.renderPolicy, expectedPolicy);
      assert.match(plan.fingerprint, /^[a-f0-9]{64}$/);
    });
  }

  test('produces stable execution fingerprints for identical inputs', () => {
    const a = createDisplayExecutionPlan({
      scene,
      target: 'projector-1',
      displayProfile: 'projector',
    });
    const b = createDisplayExecutionPlan({
      scene,
      target: 'projector-1',
      displayProfile: 'projector',
    });
    assert.equal(a.fingerprint, b.fingerprint);
  });

  test('changes the fingerprint when the display target changes', () => {
    const projector = createDisplayExecutionPlan({
      scene,
      target: 'projector-1',
      displayProfile: 'projector',
    });
    const projectorTwo = createDisplayExecutionPlan({
      scene,
      target: 'projector-2',
      displayProfile: 'projector',
    });
    assert.notEqual(projector.fingerprint, projectorTwo.fingerprint);
  });

  test('rejects a profile when the physical target type does not match', () => {
    assert.throws(
      () =>
        createDisplayExecutionPlan({
          scene,
          target: 'holomat-1',
          displayProfile: 'projector',
        }),
      /incompatible/,
    );
  });
});
