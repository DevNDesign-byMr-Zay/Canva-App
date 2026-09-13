import assert from 'node:assert/strict';
import test from 'node:test';

import { bindHolographicViewportControls } from '../../src/holographic/browser-controls.mjs';

class FakeViewport {
  constructor() {
    this.listeners = new Map();
    this.captured = new Set();
    this.ownerDocument = { activeElement: null };
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  listenerCount(type) {
    return this.listeners.get(type)?.size ?? 0;
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  setPointerCapture(pointerId) {
    this.captured.add(pointerId);
  }

  releasePointerCapture(pointerId) {
    this.captured.delete(pointerId);
  }
}

function event(values = {}) {
  return {
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    ...values,
  };
}

test('duplicate binding reuses listeners and updates the action consumer', () => {
  const viewport = new FakeViewport();
  const firstActions = [];
  const secondActions = [];

  const first = bindHolographicViewportControls({
    viewport,
    onAction: (action) => firstActions.push(action),
  });
  const second = bindHolographicViewportControls({
    viewport,
    onAction: (action) => secondActions.push(action),
  });

  assert.equal(second, first);
  assert.equal(viewport.listenerCount('keydown'), 1);
  assert.equal(viewport.listenerCount('pointermove'), 1);

  viewport.dispatch('keydown', event({ key: 'ArrowRight', shiftKey: false }));
  assert.equal(firstActions.length, 0);
  assert.deepEqual(secondActions, [{ type: 'orbit', deltaYaw: 8, deltaPitch: 0 }]);

  first.dispose();
  assert.equal(viewport.listenerCount('keydown'), 0);
  assert.equal(viewport.listenerCount('pointermove'), 0);
});

test('pointer capture drives drag actions and wheel input is focus-scoped', () => {
  const viewport = new FakeViewport();
  const actions = [];
  bindHolographicViewportControls({ viewport, onAction: (action) => actions.push(action) });

  viewport.dispatch('pointerdown', event({ pointerId: 7, clientX: 10, clientY: 20 }));
  assert.equal(viewport.captured.has(7), true);
  assert.equal(viewport.ownerDocument.activeElement, viewport);

  const drag = event({ pointerId: 7, clientX: 20, clientY: 15, shiftKey: false });
  viewport.dispatch('pointermove', drag);
  assert.equal(drag.defaultPrevented, true);
  assert.deepEqual(actions[0], { type: 'orbit', deltaYaw: 2, deltaPitch: -1 });

  viewport.dispatch('pointerup', event({ pointerId: 7 }));
  assert.equal(viewport.captured.has(7), false);

  viewport.ownerDocument.activeElement = {};
  viewport.dispatch('wheel', event({ deltaY: 100 }));
  assert.equal(actions.length, 1);

  viewport.focus();
  const wheel = event({ deltaY: 100 });
  viewport.dispatch('wheel', wheel);
  assert.equal(wheel.defaultPrevented, true);
  assert.deepEqual(actions[1], { type: 'zoom', delta: 0.2 });
});

test('selection and focus remain keyed by holographic scene node id', () => {
  const viewport = new FakeViewport();
  const actions = [];
  bindHolographicViewportControls({ viewport, onAction: (action) => actions.push(action) });

  const layer = {
    parentNode: viewport,
    getAttribute(name) {
      return name === 'data-holo-layer' ? 'hero-node' : null;
    },
  };

  viewport.dispatch('click', event({ target: layer }));
  viewport.dispatch('dblclick', event({ target: layer }));

  assert.deepEqual(actions, [
    { type: 'select', nodeId: 'hero-node' },
    { type: 'focus', nodeId: 'hero-node' },
  ]);
});
