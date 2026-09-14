import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ENERGY_BUDGET_LEVELS,
  createEnergyBudget,
} from '../../runtime/energy/energy-budget.mjs';

test('creates an immutable balanced budget by default', () => {
  const budget = createEnergyBudget({});

  assert.deepEqual(budget, {
    level: ENERGY_BUDGET_LEVELS.BALANCED,
    maxRenderUnits: 100,
  });
  assert.equal(Object.isFrozen(budget), true);
});

test('accepts every declared energy budget level', () => {
  for (const level of Object.values(ENERGY_BUDGET_LEVELS)) {
    assert.deepEqual(createEnergyBudget({ level, maxRenderUnits: 25 }), {
      level,
      maxRenderUnits: 25,
    });
  }
});

test('rejects unsupported levels and malformed render budgets', () => {
  assert.throws(
    () => createEnergyBudget({ level: 'turbo' }),
    /Unsupported energy budget level/,
  );

  for (const maxRenderUnits of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => createEnergyBudget({ maxRenderUnits }),
      /Invalid render budget/,
    );
  }
});

test('preserves an explicit zero render budget', () => {
  assert.deepEqual(createEnergyBudget({ maxRenderUnits: 0 }), {
    level: ENERGY_BUDGET_LEVELS.BALANCED,
    maxRenderUnits: 0,
  });
});
