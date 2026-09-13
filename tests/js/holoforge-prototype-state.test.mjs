import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPrototypeState,
  isScenarioSelected,
  reducePrototypeState,
} from '../../prototype/holoforge/state.js';

test('scenario changes clear explicit selection without changing view position', () => {
  let state = createPrototypeState('hierarchy-first');
  state = reducePrototypeState(state, { type: 'set-compare', percent: 74 });
  state = reducePrototypeState(state, { type: 'set-depth', percent: 68 });
  state = reducePrototypeState(state, { type: 'toggle-selection' });
  assert.equal(isScenarioSelected(state), true);

  const next = reducePrototypeState(state, { type: 'select-scenario', scenarioId: 'spacing-balance' });
  assert.equal(next.scenarioId, 'spacing-balance');
  assert.equal(next.comparePercent, 74);
  assert.equal(next.depthPercent, 68);
  assert.equal(next.selectedScenarioId, null);
});

test('compare and depth positions are clamped and reset deterministically', () => {
  const state = createPrototypeState('hierarchy-first');
  assert.equal(reducePrototypeState(state, { type: 'set-compare', percent: 120 }).comparePercent, 100);
  assert.equal(reducePrototypeState(state, { type: 'set-compare', percent: -12 }).comparePercent, 0);
  assert.equal(reducePrototypeState(state, { type: 'set-depth', percent: 180 }).depthPercent, 100);
  assert.equal(reducePrototypeState(state, { type: 'set-depth', percent: -4 }).depthPercent, 0);

  const changed = reducePrototypeState(
    reducePrototypeState(state, { type: 'set-compare', percent: 18 }),
    { type: 'set-depth', percent: 91 },
  );
  const reset = reducePrototypeState(changed, { type: 'reset-view' });
  assert.equal(reset.comparePercent, 58);
  assert.equal(reset.depthPercent, 50);
});

test('overlay state toggles only supported presentation layers', () => {
  const state = createPrototypeState('hierarchy-first');
  const next = reducePrototypeState(state, { type: 'toggle-overlay', overlay: 'attention' });
  assert.equal(next.overlays.attention, true);
  assert.equal(next.overlays.relationships, true);
  assert.throws(
    () => reducePrototypeState(state, { type: 'toggle-overlay', overlay: 'actuation' }),
    /unsupported overlay/,
  );
});

test('prototype selection never introduces mutation capability', () => {
  const state = reducePrototypeState(createPrototypeState('hierarchy-first'), { type: 'toggle-selection' });
  assert.equal(isScenarioSelected(state), true);
  assert.equal(Object.hasOwn(state, 'mutation'), false);
  assert.equal(Object.hasOwn(state, 'apply'), false);
});
