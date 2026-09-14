import { ENERGY_BUDGET_LEVELS, validateEnergyBudget } from './energy-budget.mjs';

const SCALE = Object.freeze({
  [ENERGY_BUDGET_LEVELS.ECO]: 0.5,
  [ENERGY_BUDGET_LEVELS.BALANCED]: 0.8,
  [ENERGY_BUDGET_LEVELS.PERFORMANCE]: 1,
});

export function createRenderBudgetAdvisory(budget) {
  if (!validateEnergyBudget(budget)) {
    throw new TypeError('validated energy budget is required');
  }

  return Object.freeze({
    source: Object.freeze({
      level: budget.level,
      maxRenderUnits: budget.maxRenderUnits,
    }),
    proposedRenderUnits: Math.floor(budget.maxRenderUnits * SCALE[budget.level]),
    rationale: 'energy-profile-scaling',
    application: 'explicit-consumer-decision-required',
    safety: Object.freeze({
      advisoryOnly: true,
      autoApply: false,
      authoritative: false,
      throttlesRenderer: false,
      mutatesDesign: false,
      physicalActuation: false,
    }),
  });
}
