import { ENERGY_BUDGET_LEVELS, createEnergyBudget } from './energy-budget.mjs';
import { getRenderBudget } from './render-budget.mjs';
import { summarizeEnergyChoice } from './energy-decision-summary.mjs';

describe('energy budget contracts', () => {
  test('creates validated budgets', () => {
    expect(createEnergyBudget({ level: ENERGY_BUDGET_LEVELS.ECO, maxRenderUnits: 100 })).toEqual({
      level: 'eco',
      maxRenderUnits: 100,
    });
  });

  test('scales render units by energy mode', () => {
    expect(getRenderBudget({ level: 'eco', maxRenderUnits: 101 }).renderUnits).toBe(50);
    expect(getRenderBudget({ level: 'balanced', maxRenderUnits: 101 }).renderUnits).toBe(80);
    expect(getRenderBudget({ level: 'performance', maxRenderUnits: 101 }).renderUnits).toBe(101);
  });

  test('summarizes a valid energy decision', () => {
    const result = summarizeEnergyChoice({ level: 'balanced', renderUnits: 80 });
    expect(result.decision.renderUnits).toBe(80);
    expect(result.message).toContain('balanced mode selected');
  });
});
