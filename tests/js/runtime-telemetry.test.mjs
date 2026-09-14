import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ENERGY_BUDGET_LEVELS,
  createEnergyBudget,
} from '../../runtime/energy/energy-budget.mjs';
import {
  createEnergyRuntimeTelemetry,
  validateEnergyRuntimeTelemetry,
} from '../../runtime/energy/runtime-telemetry.mjs';

function source(overrides = {}) {
  return {
    budget: createEnergyBudget({
      level: ENERGY_BUDGET_LEVELS.BALANCED,
      maxRenderUnits: 100,
    }),
    actualRenderUnits: 75,
    durationMs: 1200,
    ...overrides,
  };
}

test('records runtime diagnostics against the advisory profile without applying control', () => {
  const input = source();
  const telemetry = createEnergyRuntimeTelemetry(input);

  assert.deepEqual(telemetry.profile, {
    level: ENERGY_BUDGET_LEVELS.BALANCED,
    maxRenderUnits: 100,
    proposedRenderUnits: 80,
  });
  assert.deepEqual(telemetry.observed, {
    actualRenderUnits: 75,
    durationMs: 1200,
  });
  assert.deepEqual(telemetry.variance, {
    renderUnitsFromProposal: -5,
  });
  assert.deepEqual(telemetry.dataPolicy, {
    userDataCollected: false,
    contentCollected: false,
    designContentCollected: false,
  });
  assert.deepEqual(telemetry.safety, {
    advisoryOnly: true,
    authoritative: false,
    autoAdjustsRenderer: false,
    mutatesDesign: false,
    schedulesWork: false,
    physicalActuation: false,
  });
  assert.equal(telemetry.interpretation, 'diagnostic-only');
  assert.equal(validateEnergyRuntimeTelemetry(telemetry, input), true);
});

test('records over- and under-proposal observations without enforcing the advisory', () => {
  const low = source({ actualRenderUnits: 40 });
  const high = source({ actualRenderUnits: 120 });

  assert.equal(createEnergyRuntimeTelemetry(low).variance.renderUnitsFromProposal, -40);
  assert.equal(createEnergyRuntimeTelemetry(high).variance.renderUnitsFromProposal, 40);
  assert.equal(createEnergyRuntimeTelemetry(high).safety.autoAdjustsRenderer, false);
});

test('telemetry identity is deterministic and recursively immutable', () => {
  const input = source();
  const first = createEnergyRuntimeTelemetry(input);
  const second = createEnergyRuntimeTelemetry(input);

  assert.equal(first.telemetryFingerprint, second.telemetryFingerprint);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.profile), true);
  assert.equal(Object.isFrozen(first.observed), true);
  assert.equal(Object.isFrozen(first.variance), true);
  assert.equal(Object.isFrozen(first.dataPolicy), true);
  assert.equal(Object.isFrozen(first.safety), true);
});

test('rejects malformed observed runtime signals and authority-smuggling budgets', () => {
  assert.throws(
    () => createEnergyRuntimeTelemetry(source({ actualRenderUnits: 1.5 })),
    /actualRenderUnits must be a non-negative integer/,
  );
  assert.throws(
    () => createEnergyRuntimeTelemetry(source({ durationMs: Number.NaN })),
    /durationMs must be a non-negative finite number/,
  );
  assert.throws(
    () =>
      createEnergyRuntimeTelemetry({
        ...source(),
        budget: { level: 'balanced', maxRenderUnits: 100, autoApply: true },
      }),
    /validated energy budget is required/,
  );
});

test('tampered diagnostics or safety state fail validation', () => {
  const input = source();
  const telemetry = createEnergyRuntimeTelemetry(input);

  assert.equal(
    validateEnergyRuntimeTelemetry(
      {
        ...telemetry,
        observed: { ...telemetry.observed, actualRenderUnits: 80 },
      },
      input,
    ),
    false,
  );
  assert.equal(
    validateEnergyRuntimeTelemetry(
      {
        ...telemetry,
        safety: { ...telemetry.safety, autoAdjustsRenderer: true },
      },
      input,
    ),
    false,
  );
});
