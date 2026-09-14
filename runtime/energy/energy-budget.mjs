export const ENERGY_BUDGET_LEVELS = Object.freeze({
  ECO: 'eco',
  BALANCED: 'balanced',
  PERFORMANCE: 'performance',
});

export function createEnergyBudget({ level = ENERGY_BUDGET_LEVELS.BALANCED, maxRenderUnits = 100 }) {
  if (!Object.values(ENERGY_BUDGET_LEVELS).includes(level)) {
    throw new Error('Unsupported energy budget level');
  }

  if (!Number.isFinite(maxRenderUnits) || maxRenderUnits < 0) {
    throw new Error('Invalid render budget');
  }

  return Object.freeze({
    level,
    maxRenderUnits,
  });
}
