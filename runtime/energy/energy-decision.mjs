import { ENERGY_BUDGET_LEVELS } from './energy-budget.mjs';

const DEFAULT_REASONS = Object.freeze({
  eco: 'reduced-energy mode',
  balanced: 'balanced quality and energy use',
  performance: 'full rendering budget',
});

export function createEnergyDecision({ level, renderUnits, reason } = {}) {
  if (!Object.values(ENERGY_BUDGET_LEVELS).includes(level)) {
    throw new Error('Unsupported energy budget level');
  }
  if (!Number.isInteger(renderUnits) || renderUnits < 0) {
    throw new Error('Invalid render units');
  }

  return Object.freeze({
    level,
    renderUnits,
    reason: reason ?? DEFAULT_REASONS[level],
  });
}
