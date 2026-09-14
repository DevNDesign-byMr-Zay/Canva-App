export const ENERGY_MODES = Object.freeze({
  ECO: "eco",
  BALANCED: "balanced",
  PERFORMANCE: "performance",
});

export function selectEnergyProfile({
  batteryPercent = 100,
  prefersReducedMotion = false,
  deviceClass = "balanced",
} = {}) {
  if (batteryPercent < 20 || prefersReducedMotion) {
    return ENERGY_MODES.ECO;
  }

  if (deviceClass === "high-performance") {
    return ENERGY_MODES.PERFORMANCE;
  }

  return ENERGY_MODES.BALANCED;
}
