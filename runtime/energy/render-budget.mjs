import { ENERGY_BUDGET_LEVELS } from './energy-budget.mjs';

const SCALE = Object.freeze({
  [ENERGY_BUDGET_LEVELS.ECO]: 0.5,
  [ENERGY_BUDGET_LEVELS.BALANCED]: 0.8,
  [ENERGY_BUDGET_LEVELS.PERFORMANCE]: 1,
});

export function getRenderBudget({ level, maxRenderUnits } = {}) {
  if (!Object.hasOwn(SCALE, level)) {
    throw new Error('Unsupported energy budget level');
  }
  if (!Number.isFinite(maxRenderUnits) || maxRenderUnits < 0) {
    throw new Error('Invalid render budget');
  }

  return Object.freeze({
    level,
    renderUnits: Math.floor(maxRenderUnits * SCALE[level]),
  });
}
