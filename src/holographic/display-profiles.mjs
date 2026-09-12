export const DISPLAY_PROFILE_SCHEMA = 'canva.holographic-display-profile.v1';

const PROFILES = Object.freeze({
  simulator: Object.freeze({
    targetType: 'simulator',
    capabilities: Object.freeze(['preview', 'deterministic-replay']),
  }),
  projector: Object.freeze({
    targetType: 'projector',
    capabilities: Object.freeze(['depth', 'perspective']),
  }),
  holomat: Object.freeze({
    targetType: 'holomat',
    capabilities: Object.freeze(['depth', 'surface-mapping']),
  }),
  'three-d-platform': Object.freeze({
    targetType: 'three-d-platform',
    capabilities: Object.freeze(['depth', 'platform-staging']),
  }),
});

const TARGET_TYPES = Object.freeze(['projector', 'holomat', 'three-d-platform']);

function inferTargetType(target) {
  if (target === 'simulator') return 'simulator';
  return (
    TARGET_TYPES.find((type) => target === type || target.startsWith(`${type}-`)) ?? null
  );
}

export function getDisplayProfile(name = 'default') {
  if (typeof name !== 'string' || !name.trim()) {
    throw new TypeError('A display profile is required.');
  }
  const requestedId = name.trim();
  const id = requestedId === 'default' ? 'simulator' : requestedId;
  const profile = PROFILES[id];
  if (!profile) throw new TypeError(`Unsupported display profile: ${name}`);
  return Object.freeze({ schema: DISPLAY_PROFILE_SCHEMA, id, ...profile });
}

export function validateDisplayProfile({ target, displayProfile = 'default' } = {}) {
  if (typeof target !== 'string' || !target.trim()) {
    throw new TypeError('A holographic export target is required.');
  }

  const normalizedTarget = target.trim();
  const profile = getDisplayProfile(displayProfile);
  const targetType = inferTargetType(normalizedTarget);

  if (targetType === 'simulator' && profile.targetType !== 'simulator') {
    throw new Error(`Display profile ${profile.id} is incompatible with simulator target.`);
  }
  if (targetType !== 'simulator' && profile.targetType === 'simulator') {
    throw new Error(
      `Display profile ${profile.id} is incompatible with physical target ${normalizedTarget}.`,
    );
  }
  if (targetType && targetType !== profile.targetType) {
    throw new Error(
      `Display profile ${profile.id} is incompatible with ${targetType} target ${normalizedTarget}.`,
    );
  }

  return profile;
}
