import { createHash } from 'node:crypto';
import { getDisplayProfile, validateDisplayProfile } from './display-profiles.mjs';

export const DISPLAY_EXECUTION_SCHEMA = 'canva.holographic-display-execution.v1';

const REQUIRED_CAPABILITIES = Object.freeze({
  simulator: Object.freeze(['preview', 'deterministic-replay']),
  projector: Object.freeze(['depth', 'perspective']),
  holomat: Object.freeze(['depth', 'surface-mapping']),
  'three-d-platform': Object.freeze(['depth', 'platform-staging']),
});

const OPERATIONS = Object.freeze({
  simulator: 'preview-and-replay',
  projector: 'prepare-projector',
  holomat: 'prepare-holomat',
  'three-d-platform': 'prepare-three-d-platform',
});

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function createDisplayExecutionPlan({ scene, target, displayProfile = 'default' } = {}) {
  if (!scene || scene.schema !== 'holo.scene.v1') throw new TypeError('A holo.scene.v1 scene is required.');
  const profile = getDisplayProfile(displayProfile);
  validateDisplayProfile({ target, displayProfile: profile.id });
  const required = REQUIRED_CAPABILITIES[profile.targetType] ?? [];
  const missing = required.filter((capability) => !profile.capabilities.includes(capability));
  if (missing.length) throw new Error(`Display profile is missing required capabilities: ${missing.join(', ')}`);

  const plan = {
    schema: DISPLAY_EXECUTION_SCHEMA,
    sceneId: scene.id,
    target,
    profileId: profile.id,
    profileSchema: profile.schema,
    targetType: profile.targetType,
    capabilities: Object.freeze([...profile.capabilities]),
    operation: OPERATIONS[profile.targetType],
    renderPolicy: Object.freeze({ depth: profile.capabilities.includes('depth'), perspective: profile.capabilities.includes('perspective'), surfaceMapping: profile.capabilities.includes('surface-mapping'), platformStaging: profile.capabilities.includes('platform-staging'), deterministicReplay: profile.capabilities.includes('deterministic-replay') }),
  };
  return Object.freeze({ ...plan, fingerprint: fingerprint(plan) });
}
