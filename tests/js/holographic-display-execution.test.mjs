import { createHolographicScene } from '../../src/holographic/scene.mjs';
import { createDisplayExecutionPlan } from '../../src/holographic/display-execution.mjs';

describe('holographic display execution planning', () => {
  const scene = createHolographicScene({ id: 'demo', title: 'Demo', nodes: [{ id: 'hero' }] });

  test.each([
    ['simulator', 'simulator', 'preview-and-replay'],
    ['projector', 'projector-1', 'prepare-projector'],
    ['holomat', 'holomat-1', 'prepare-holomat'],
    ['three-d-platform', 'three-d-platform-1', 'prepare-three-d-platform'],
  ])('maps %s profile to an explicit operation', (displayProfile, target, operation) => {
    const plan = createDisplayExecutionPlan({ scene, target, displayProfile });
    expect(plan).toMatchObject({ profileId: displayProfile, target, operation });
    expect(plan.profileSchema).toBe('canva.holographic-display-profile.v1');
  });

  test('rejects a profile when the physical target type does not match', () => {
    expect(() => createDisplayExecutionPlan({ scene, target: 'holomat-1', displayProfile: 'projector' })).toThrow(/incompatible/);
  });
});
