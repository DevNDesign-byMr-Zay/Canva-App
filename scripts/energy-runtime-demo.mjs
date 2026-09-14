import {
  ENERGY_BUDGET_LEVELS,
  createEnergyBudget,
  validateEnergyBudget,
} from '../runtime/energy/energy-budget.mjs';
import { createRenderBudgetAdvisory } from '../runtime/energy/render-budget-advisory.mjs';
import {
  createEnergyRuntimeTelemetry,
  validateEnergyRuntimeTelemetry,
} from '../runtime/energy/runtime-telemetry.mjs';

const budget = createEnergyBudget({
  level: ENERGY_BUDGET_LEVELS.BALANCED,
  maxRenderUnits: 100,
});
if (!validateEnergyBudget(budget)) {
  throw new Error('energy budget failed validation');
}

const advisory = createRenderBudgetAdvisory(budget);
if (
  advisory.safety.advisoryOnly !== true ||
  advisory.safety.autoApply !== false ||
  advisory.safety.authoritative !== false ||
  advisory.safety.throttlesRenderer !== false ||
  advisory.safety.mutatesDesign !== false ||
  advisory.safety.physicalActuation !== false
) {
  throw new Error('render budget advisory crossed its non-automatic boundary');
}

const telemetrySource = {
  budget,
  actualRenderUnits: 76,
  durationMs: 1200,
};
const telemetry = createEnergyRuntimeTelemetry(telemetrySource);
if (!validateEnergyRuntimeTelemetry(telemetry, telemetrySource)) {
  throw new Error('runtime telemetry failed validation');
}
if (
  telemetry.dataPolicy.userDataCollected !== false ||
  telemetry.dataPolicy.contentCollected !== false ||
  telemetry.dataPolicy.designContentCollected !== false
) {
  throw new Error('diagnostic telemetry must not collect user or design content');
}
if (
  telemetry.safety.advisoryOnly !== true ||
  telemetry.safety.authoritative !== false ||
  telemetry.safety.autoAdjustsRenderer !== false ||
  telemetry.safety.mutatesDesign !== false ||
  telemetry.safety.schedulesWork !== false ||
  telemetry.safety.physicalActuation !== false
) {
  throw new Error('runtime telemetry crossed its diagnostic-only safety boundary');
}

const summary = {
  profile: budget.level,
  maxRenderUnits: budget.maxRenderUnits,
  proposedRenderUnits: advisory.proposedRenderUnits,
  application: advisory.application,
  observedRenderUnits: telemetry.observed.actualRenderUnits,
  durationMs: telemetry.observed.durationMs,
  renderUnitsFromProposal: telemetry.variance.renderUnitsFromProposal,
  telemetryFingerprint: telemetry.telemetryFingerprint,
  interpretation: telemetry.interpretation,
  collectsUserData: telemetry.dataPolicy.userDataCollected,
  collectsDesignContent: telemetry.dataPolicy.designContentCollected,
  autoAdjustsRenderer: telemetry.safety.autoAdjustsRenderer,
  mutatesDesign: telemetry.safety.mutatesDesign,
  authoritative: telemetry.safety.authoritative,
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
