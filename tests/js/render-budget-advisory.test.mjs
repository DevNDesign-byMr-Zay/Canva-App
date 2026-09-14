import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ENERGY_BUDGET_LEVELS,
  createEnergyBudget,
  validateEnergyBudget,
} from '../../runtime/energy/energy-budget.mjs';
import { createRenderBudgetAdvisory } from '../../runtime/energy/render-budget-advisory.mjs';

test('validates only the exact immutable energy-budget contract shape', () => {
  const budget = createEnergyBudget({ level: ENERGY_BUDGET_LEVELS.ECO, maxRenderUnits: 40 });

  assert.equal(validateEnergyBudget(budget), true);
  assert.equal(validateEnergyBudget({ ...budget, autoApply: true }), false);
  assert.equal(validateEnergyBudget({ level: 'turbo', maxRenderUnits: 40 }), false);
  assert.equal(validateEnergyBudget({ level: ENERGY_BUDGET_LEVELS.ECO, maxRenderUnits: -1 }), false);
});

test('derives deterministic profile-scaled render advisories without applying them', () => {
  const cases = [
    [ENERGY_BUDGET_LEVELS.ECO, 50],
    [ENERGY_BUDGET_LEVELS.BALANCED, 80],
    [ENERGY_BUDGET_LEVELS.PERFORMANCE, 100],
  ];

  for (const [level, expected] of cases) {
    const advisory = createRenderBudgetAdvisory(createEnergyBudget({ level, maxRenderUnits: 100 }));

    assert.equal(advisory.proposedRenderUnits, expected);
    assert.equal(advisory.application, 'explicit-consumer-decision-required');
    assert.deepEqual(advisory.safety, {
      advisoryOnly: true,
      autoApply: false,
      authoritative: false,
      throttlesRenderer: false,
      mutatesDesign: false,
      physicalActuation: false,
    });
    assert.equal(Object.isFrozen(advisory), true);
    assert.equal(Object.isFrozen(advisory.source), true);
    assert.equal(Object.isFrozen(advisory.safety), true);
  }
});

test('preserves explicit zero capacity without inventing render work', () => {
  const advisory = createRenderBudgetAdvisory(
    createEnergyBudget({ level: ENERGY_BUDGET_LEVELS.PERFORMANCE, maxRenderUnits: 0 }),
  );

  assert.equal(advisory.proposedRenderUnits, 0);
});

test('rejects malformed or authority-smuggling budget objects before projection', () => {
  assert.throws(
    () => createRenderBudgetAdvisory({ level: 'eco', maxRenderUnits: 100, autoApply: true }),
    /validated energy budget is required/,
  );
  assert.throws(
    () => createRenderBudgetAdvisory({ level: 'eco', maxRenderUnits: Number.NaN }),
    /validated energy budget is required/,
  );
});
