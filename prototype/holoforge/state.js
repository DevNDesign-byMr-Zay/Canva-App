const OVERLAYS = new Set(['relationships', 'evidence', 'attention']);

export function createPrototypeState(scenarioId) {
  if (typeof scenarioId !== 'string' || !scenarioId.trim()) {
    throw new TypeError('scenarioId must be a non-empty string');
  }

  return Object.freeze({
    scenarioId,
    comparePercent: 58,
    selectedScenarioId: null,
    overlays: Object.freeze({ relationships: true, evidence: true, attention: false }),
  });
}

function clampPercent(value) {
  if (!Number.isFinite(value)) throw new TypeError('compare percent must be finite');
  return Math.min(100, Math.max(0, value));
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
      return Object.freeze({ ...state, comparePercent: clampPercent(action.percent) });
    case 'reset-view':
      return Object.freeze({ ...state, comparePercent: 58 });
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
