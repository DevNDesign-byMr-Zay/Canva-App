import { createHash } from 'node:crypto';

import { validateEnergyBudget } from './energy-budget.mjs';
import { createRenderBudgetAdvisory } from './render-budget-advisory.mjs';

const TELEMETRY_VERSION = 1;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

function fingerprint(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)), 'utf8')
    .digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function nonNegativeFinite(value, name) {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative finite number`);
  }
  return value;
}

function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative integer`);
  }
  return value;
}

function telemetryBody({ budget, actualRenderUnits, durationMs }) {
  if (!validateEnergyBudget(budget)) {
    throw new TypeError('validated energy budget is required');
  }
  const advisory = createRenderBudgetAdvisory(budget);
  const observedRenderUnits = nonNegativeInteger(actualRenderUnits, 'actualRenderUnits');
  const observedDurationMs = nonNegativeFinite(durationMs, 'durationMs');

  return {
    version: TELEMETRY_VERSION,
    profile: {
      level: budget.level,
      maxRenderUnits: budget.maxRenderUnits,
      proposedRenderUnits: advisory.proposedRenderUnits,
    },
    observed: {
      actualRenderUnits: observedRenderUnits,
      durationMs: observedDurationMs,
    },
    variance: {
      renderUnitsFromProposal: observedRenderUnits - advisory.proposedRenderUnits,
    },
    interpretation: 'diagnostic-only',
    dataPolicy: {
      userDataCollected: false,
      contentCollected: false,
      designContentCollected: false,
    },
    safety: {
      advisoryOnly: true,
      authoritative: false,
      autoAdjustsRenderer: false,
      mutatesDesign: false,
      schedulesWork: false,
      physicalActuation: false,
    },
  };
}

export function createEnergyRuntimeTelemetry(input) {
  const body = telemetryBody(input);
  return deepFreeze({
    ...body,
    telemetryFingerprint: fingerprint(body),
  });
}

export function validateEnergyRuntimeTelemetry(telemetry, source) {
  try {
    if (!telemetry || typeof telemetry !== 'object' || Array.isArray(telemetry)) return false;
    if (!/^[a-f0-9]{64}$/.test(telemetry.telemetryFingerprint)) return false;
    const expectedBody = telemetryBody(source);
    const actualBody = Object.fromEntries(
      Object.entries(telemetry).filter(([key]) => key !== 'telemetryFingerprint'),
    );
    if (JSON.stringify(canonical(actualBody)) !== JSON.stringify(canonical(expectedBody))) {
      return false;
    }
    return telemetry.telemetryFingerprint === fingerprint(expectedBody);
  } catch {
    return false;
  }
}

export { TELEMETRY_VERSION as ENERGY_RUNTIME_TELEMETRY_VERSION };
