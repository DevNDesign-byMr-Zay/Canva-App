import { createHolographicScene } from '../../src/holographic/scene.mjs';
import { createDisplayExecutionPlan } from '../../src/holographic/display-execution.mjs';

describe('holographic display execution planning', () => {
  const scene = createHolographicScene({ id: 'demo', title: 'Demo', nodes: [{ id: 'hero' }] });

  test.each([
    ['simulator', 'simulator', 'preview-and-replay', { deterministicReplay: true }],
    ['projector', 'projector-1', 'prepare-projector', { depth: true, perspective: true }],
    ['holomat', 'holomat-1', 'prepare-holomat', { depth: true, surfaceMapping: true }],
    ['three-d-platform', 'three-d-platform-1', 'prepare-three-d-platform', { depth: true, platformStaging: true }],
  ])('maps %s profile to an explicit operation and render policy', (displayProfile, target, operation, expectedPolicy) => {
    const plan = createDisplayExecutionPlan({ scene, target, displayProfile });
    expect(plan).toMatchObject({ profileId: displayProfile, target, operation });
    expect(plan.profileSchema).toBe('canva.holographic-display-profile.v1');
    expect(plan.renderPolicy).toMatchObject(expectedPolicy);
    expect(plan.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  test('produces stable execution fingerprints for identical inputs', () => {
    const a = createDisplayExecutionPlan({ scene, target: 'projector-1', displayProfile: 'projector' });
    const b = createDisplayExecutionPlan({ scene, target: 'projector-1', displayProfile: 'projector' });
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  test('changes the fingerprint when the display target changes', () => {
    const projector = createDisplayExecutionPlan({ scene, target: 'projector-1', displayProfile: 'projector' });
    const projectorTwo = createDisplayExecutionPlan({ scene, target: 'projector-2', displayProfile: 'projector' });
    expect(projector.fingerprint).not.toBe(projectorTwo.fingerprint);
  });

  test('rejects a profile when the physical target type does not match', () => {
    expect(() => createDisplayExecutionPlan({ scene, target: 'holomat-1', displayProfile: 'projector' })).toThrow(/incompatible/);
  });
});
