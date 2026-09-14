export function createEnergyTelemetryEvent({ profile, renderUnits = 0, reason = 'runtime-decision' } = {}) {
  if (!profile) {
    throw new Error('Energy profile is required');
  }
  if (!Number.isFinite(renderUnits) || renderUnits < 0) {
    throw new Error('renderUnits must be non-negative');
  }

  return Object.freeze({
    type: 'energy-runtime-event',
    profile,
    renderUnits,
    reason,
    timestampSource: 'runtime',
  });
}
