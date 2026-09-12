import { getDisplayProfile, validateDisplayProfile } from './display-profiles.mjs';

export const DISPLAY_EXECUTION_SCHEMA = 'canva.holographic-display-execution.v1';

const REQUIRED_CAPABILITIES = Object.freeze({
  simulator: Object.freeze(['preview', 'deterministic-replay']),
  projector: Object.freeze(['depth', 'perspective']),
  holomat: Object.freeze(['depth', 'surface-mapping']),
  'three-d-platform': Object.freeze(['depth', 'platform-staging']),
});

export function createDisplayExecutionPlan({ scene, target, displayProfile = 'default' } = {}) {
  if (!scene || scene.schema !== 'holo.scene.v1') throw new TypeError('A holo.scene.v1 scene is required.');
  const profile = getDisplayProfile(displayProfile);
  validateDisplayProfile({ target, displayProfile: profile.id });
  const required = REQUIRED_CAPABILITIES[profile.targetType] ?? [];
  const missing = required.filter((capability) => !profile.capabilities.includes(capability));
  if (missing.length) throw new Error(`Display profile is missing required capabilities: ${missing.join(', ')}`);

  return Object.freeze({
    schema: DISPLAY_EXECUTION_SCHEMA,
    sceneId: scene.id,
    target,
    profileId: profile.id,
    profileSchema: profile.schema,
    targetType: profile.targetType,
    capabilities: Object.freeze([...profile.capabilities]),
    operation: profile.targetType === 'simulator' ? 'preview-and-replay' : `prepare-${profile.targetType}`,
  });
}
