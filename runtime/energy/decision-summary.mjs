export function summarizeEnergyDecision({ profile, renderUnits, reason }) {
  if (!profile || !Number.isFinite(renderUnits) || renderUnits < 0) {
    throw new Error('Invalid energy decision summary input');
  }

  return Object.freeze({
    profile,
    renderUnits,
    reason: reason || 'runtime-selected',
  });
}
