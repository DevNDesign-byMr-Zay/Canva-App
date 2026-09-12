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

  for (const [displayProfile, target, operation] of [
    ['simulator', 'simulator', 'preview-and-replay'],
    ['projector', 'projector-1', 'prepare-projector'],
    ['holomat', 'holomat-1', 'prepare-holomat'],
    ['three-d-platform', 'three-d-platform-1', 'prepare-three-d-platform'],
  ]) {
    test(`maps ${displayProfile} profile to an explicit operation`, () => {
      const plan = createDisplayExecutionPlan({ scene, target, displayProfile });
      assert.equal(plan.profileId, displayProfile);
      assert.equal(plan.target, target);
      assert.equal(plan.operation, operation);
      assert.equal(plan.profileSchema, 'canva.holographic-display-profile.v1');
    });
  }

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
