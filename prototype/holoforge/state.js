const OVERLAYS = new Set(['relationships', 'evidence', 'attention']);
const COMPARE_PRESETS = Object.freeze({ original: 0, split: 58, candidate: 100 });

export function createPrototypeState(scenarioId) {
  if (typeof scenarioId !== 'string' || !scenarioId.trim()) {
    throw new TypeError('scenarioId must be a non-empty string');
  }

  return Object.freeze({
    scenarioId,
    comparePercent: 58,
    depthPercent: 50,
    selectedScenarioId: null,
    overlays: Object.freeze({ relationships: true, evidence: true, attention: false }),
  });
}

function clampPercent(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
  return Math.min(100, Math.max(0, value));
}

export function resolveScenarioNavigation(scenarioIds, currentId, key) {
  if (!Array.isArray(scenarioIds) || scenarioIds.length === 0) {
    throw new TypeError('scenarioIds must be a non-empty array');
  }
  if (scenarioIds.some((id) => typeof id !== 'string' || !id.trim())) {
    throw new TypeError('scenarioIds must contain non-empty strings');
  }

  const currentIndex = Math.max(0, scenarioIds.indexOf(currentId));
  if (key === 'Home') return scenarioIds[0];
  if (key === 'End') return scenarioIds.at(-1);
  if (key === 'ArrowDown' || key === 'ArrowRight') {
    return scenarioIds[(currentIndex + 1) % scenarioIds.length];
  }
  if (key === 'ArrowUp' || key === 'ArrowLeft') {
    return scenarioIds[(currentIndex - 1 + scenarioIds.length) % scenarioIds.length];
  }
  return currentId;
}

export function reducePrototypeState(state, action = {}) {
  if (!state || typeof state !== 'object') throw new TypeError('state must be an object');

  switch (action.type) {
    case 'select-scenario': {
      if (typeof action.scenarioId !== 'string' || !action.scenarioId.trim()) {
        throw new TypeError('scenarioId must be a non-empty string');
      }
      return Object.freeze({
        ...state,
        scenarioId: action.scenarioId,
        selectedScenarioId: null,
      });
    }
    case 'set-compare':
      return Object.freeze({ ...state, comparePercent: clampPercent(action.percent, 'compare percent') });
    case 'set-compare-preset': {
      if (!Object.hasOwn(COMPARE_PRESETS, action.preset)) {
        throw new TypeError('unsupported compare preset');
      }
      return Object.freeze({ ...state, comparePercent: COMPARE_PRESETS[action.preset] });
    }
    case 'set-depth':
      return Object.freeze({ ...state, depthPercent: clampPercent(action.percent, 'depth percent') });
    case 'reset-view':
      return Object.freeze({ ...state, comparePercent: 58, depthPercent: 50 });
    case 'toggle-overlay': {
      if (!OVERLAYS.has(action.overlay)) throw new TypeError('unsupported overlay');
      return Object.freeze({
        ...state,
        overlays: Object.freeze({
          ...state.overlays,
          [action.overlay]: !state.overlays[action.overlay],
        }),
      });
    }
    case 'toggle-selection':
      return Object.freeze({
        ...state,
        selectedScenarioId: state.selectedScenarioId === state.scenarioId ? null : state.scenarioId,
      });
    default:
      throw new TypeError('unsupported prototype action');
  }
}

export function isScenarioSelected(state) {
  return state?.selectedScenarioId === state?.scenarioId;
}
