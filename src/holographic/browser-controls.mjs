import { createHolographicControlAdapter, HOLO_CONTROLS_SCHEMA } from './controls.mjs';

export const HOLO_BROWSER_CONTROLS_SCHEMA = 'holo.browser-controls.v1';

const bindings = new WeakMap();

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function requireViewport(viewport) {
  if (
    !viewport ||
    typeof viewport.addEventListener !== 'function' ||
    typeof viewport.removeEventListener !== 'function'
  ) {
    throw new TypeError('A viewport with DOM event listener support is required.');
  }
  return viewport;
}

function requireControls(controls) {
  if (!controls || controls.schema !== HOLO_CONTROLS_SCHEMA) {
    throw new TypeError('A valid holographic control adapter is required.');
  }
  return controls;
}

function requireActionHandler(onAction) {
  if (typeof onAction !== 'function') {
    throw new TypeError('onAction must be a function.');
  }
  return onAction;
}

function layerIdFromTarget(target, viewport) {
  let node = target;
  while (node && node !== viewport) {
    if (typeof node.getAttribute === 'function') {
      const nodeId = node.getAttribute('data-holo-layer');
      if (nodeId) return nodeId;
    }
    node = node.parentNode;
  }
  return null;
}

export function bindHolographicViewportControls({
  viewport,
  controls = createHolographicControlAdapter(),
  onAction,
} = {}) {
  requireViewport(viewport);
  requireControls(controls);
  requireActionHandler(onAction);

  const existing = bindings.get(viewport);
  if (existing) {
    existing.controls = controls;
    existing.onAction = onAction;
    return existing.binding;
  }

  const state = {
    controls,
    onAction,
    pointer: null,
    binding: null,
  };

  const dispatch = (action, event) => {
    if (!action) return false;
    state.onAction(action, event);
    return true;
  };

  const onPointerDown = (event) => {
    const pointerId = event.pointerId;
    state.pointer = {
      id: pointerId,
      x: finite(event.clientX),
      y: finite(event.clientY),
    };
    viewport.focus?.();
    if (pointerId !== undefined) viewport.setPointerCapture?.(pointerId);
  };

  const onPointerMove = (event) => {
    if (!state.pointer) return;
    if (event.pointerId !== undefined && event.pointerId !== state.pointer.id) return;

    const x = finite(event.clientX, state.pointer.x);
    const y = finite(event.clientY, state.pointer.y);
    const action = state.controls.fromPointerDrag({
      deltaX: x - state.pointer.x,
      deltaY: y - state.pointer.y,
      mode: event.shiftKey ? 'pan' : 'orbit',
    });
    state.pointer = { id: state.pointer.id, x, y };
    dispatch(action, event);
    event.preventDefault?.();
  };

  const endPointer = (event) => {
    if (!state.pointer) return;
    if (event.pointerId !== undefined && event.pointerId !== state.pointer.id) return;

    const pointerId = state.pointer.id;
    state.pointer = null;
    if (pointerId !== undefined) viewport.releasePointerCapture?.(pointerId);
  };

  const onWheel = (event) => {
    if (viewport.ownerDocument?.activeElement !== viewport) return;
    if (dispatch(state.controls.fromWheel({ deltaY: event.deltaY }), event)) {
      event.preventDefault?.();
    }
  };

  const onKeyDown = (event) => {
    if (dispatch(state.controls.fromKey({ key: event.key, shiftKey: event.shiftKey }), event)) {
      event.preventDefault?.();
    }
  };

  const onClick = (event) => {
    const nodeId = layerIdFromTarget(event.target, viewport);
    if (nodeId) dispatch(state.controls.fromActivation({ nodeId }), event);
  };

  const onDoubleClick = (event) => {
    const nodeId = layerIdFromTarget(event.target, viewport);
    if (nodeId) dispatch(state.controls.fromActivation({ nodeId, focus: true }), event);
  };

  const listeners = Object.freeze([
    ['pointerdown', onPointerDown],
    ['pointermove', onPointerMove],
    ['pointerup', endPointer],
    ['pointercancel', endPointer],
    ['wheel', onWheel],
    ['keydown', onKeyDown],
    ['click', onClick],
    ['dblclick', onDoubleClick],
  ]);

  for (const [type, listener] of listeners) viewport.addEventListener(type, listener);

  state.binding = Object.freeze({
    schema: HOLO_BROWSER_CONTROLS_SCHEMA,
    dispose() {
      for (const [type, listener] of listeners) viewport.removeEventListener(type, listener);
      if (state.pointer?.id !== undefined) viewport.releasePointerCapture?.(state.pointer.id);
      state.pointer = null;
      bindings.delete(viewport);
    },
  });

  bindings.set(viewport, state);
  return state.binding;
}
