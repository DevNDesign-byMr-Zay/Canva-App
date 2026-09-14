export const ENERGY_BUDGET_LEVELS = Object.freeze({
  ECO: 'eco',
  BALANCED: 'balanced',
  PERFORMANCE: 'performance',
});

export function validateEnergyBudget(budget) {
  if (!budget || typeof budget !== 'object' || Array.isArray(budget)) return false;
  if (!Object.values(ENERGY_BUDGET_LEVELS).includes(budget.level)) return false;
  if (!Number.isFinite(budget.maxRenderUnits) || budget.maxRenderUnits < 0) return false;
  return Object.keys(budget).sort().join(',') === 'level,maxRenderUnits';
}

export function createEnergyBudget({ level = ENERGY_BUDGET_LEVELS.BALANCED, maxRenderUnits = 100 }) {
  const budget = { level, maxRenderUnits };
  if (!validateEnergyBudget(budget)) {
    if (!Object.values(ENERGY_BUDGET_LEVELS).includes(level)) {
      throw new Error('Unsupported energy budget level');
    }
    throw new Error('Invalid render budget');
  }

  return Object.freeze(budget);
}
