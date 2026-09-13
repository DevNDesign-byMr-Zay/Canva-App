export const HOLO_CONTROLS_SCHEMA = 'holo.controls.v1';

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function positive(value, fallback) {
  const resolved = finite(value, fallback);
  return resolved > 0 ? resolved : fallback;
}

function action(value) {
  return Object.freeze(value);
}

export function createHolographicControlAdapter({
  orbitSensitivity = 0.2,
  panSensitivity = 0.01,
  zoomSensitivity = 0.002,
  keyboardOrbitStep = 8,
  keyboardPanStep = 0.4,
  keyboardZoomStep = 0.75,
} = {}) {
  const config = Object.freeze({
    orbitSensitivity: positive(orbitSensitivity, 0.2),
    panSensitivity: positive(panSensitivity, 0.01),
    zoomSensitivity: positive(zoomSensitivity, 0.002),
    keyboardOrbitStep: positive(keyboardOrbitStep, 8),
    keyboardPanStep: positive(keyboardPanStep, 0.4),
    keyboardZoomStep: positive(keyboardZoomStep, 0.75),
  });

  return Object.freeze({
    schema: HOLO_CONTROLS_SCHEMA,
    config,

    fromPointerDrag({ deltaX = 0, deltaY = 0, mode = 'orbit' } = {}) {
      const x = finite(deltaX);
      const y = finite(deltaY);

      if (mode === 'orbit') {
        return action({
          type: 'orbit',
          deltaYaw: x * config.orbitSensitivity,
          deltaPitch: y * config.orbitSensitivity,
        });
      }

      if (mode === 'pan') {
        return action({
          type: 'pan',
          x: -x * config.panSensitivity,
          y: y * config.panSensitivity,
          z: 0,
        });
      }

      throw new RangeError(`Unsupported pointer control mode: ${mode}`);
    },

    fromWheel({ deltaY = 0 } = {}) {
      return action({
        type: 'zoom',
        delta: finite(deltaY) * config.zoomSensitivity,
      });
    },

    fromKey({ key, shiftKey = false } = {}) {
      switch (key) {
        case 'ArrowLeft':
          return shiftKey
            ? action({ type: 'pan', x: -config.keyboardPanStep, y: 0, z: 0 })
            : action({ type: 'orbit', deltaYaw: -config.keyboardOrbitStep, deltaPitch: 0 });
        case 'ArrowRight':
          return shiftKey
            ? action({ type: 'pan', x: config.keyboardPanStep, y: 0, z: 0 })
            : action({ type: 'orbit', deltaYaw: config.keyboardOrbitStep, deltaPitch: 0 });
        case 'ArrowUp':
          return shiftKey
            ? action({ type: 'pan', x: 0, y: config.keyboardPanStep, z: 0 })
            : action({ type: 'orbit', deltaYaw: 0, deltaPitch: -config.keyboardOrbitStep });
        case 'ArrowDown':
          return shiftKey
            ? action({ type: 'pan', x: 0, y: -config.keyboardPanStep, z: 0 })
            : action({ type: 'orbit', deltaYaw: 0, deltaPitch: config.keyboardOrbitStep });
        case '+':
        case '=':
          return action({ type: 'zoom', delta: -config.keyboardZoomStep });
        case '-':
        case '_':
          return action({ type: 'zoom', delta: config.keyboardZoomStep });
        case 'Escape':
          return action({ type: 'clear-selection' });
        default:
          return null;
      }
    },

    fromActivation({ nodeId, focus = false } = {}) {
      if (typeof nodeId !== 'string' || !nodeId.trim()) {
        throw new TypeError('A node id is required for activation.');
      }
      return action({ type: focus ? 'focus' : 'select', nodeId: nodeId.trim() });
    },
  });
}
