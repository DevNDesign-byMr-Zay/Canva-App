import { createEnergyDecision } from './energy-decision.mjs';

export function summarizeEnergyChoice({ level, renderUnits, reason } = {}) {
  const decision = createEnergyDecision({ level, renderUnits, reason });

  return Object.freeze({
    message: `${decision.level} mode selected: ${decision.reason}`,
    decision,
  });
}
