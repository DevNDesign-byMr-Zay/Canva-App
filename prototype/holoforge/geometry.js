function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

export function reconstructSourceConfig(candidateConfig = {}, delta = {}) {
  finite(candidateConfig.x, 'candidate x');
  finite(candidateConfig.y, 'candidate y');

  const candidateScale = Number.isFinite(candidateConfig.scale) ? candidateConfig.scale : 1;
  const sourceScale = candidateScale - (delta.scale ?? 0);
  if (!Number.isFinite(sourceScale) || sourceScale <= 0) {
    throw new TypeError('reconstructed source scale must be positive');
  }

  return Object.freeze({
    ...candidateConfig,
    x: candidateConfig.x - (delta.x ?? 0),
    y: candidateConfig.y - (delta.y ?? 0),
    z: (candidateConfig.z ?? 0) - (delta.z ?? 0),
    scale: sourceScale,
  });
}

export function projectDesignConfig(config, { width = 600, height = 500 } = {}) {
  finite(config?.x, 'config x');
  finite(config?.y, 'config y');
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new TypeError('design dimensions must be positive finite numbers');
  }

  const scale = Number.isFinite(config.scale) ? config.scale : 1;
  if (scale <= 0) throw new TypeError('config scale must be positive');

  return Object.freeze({
    leftPercent: (config.x / width) * 100,
    topPercent: (config.y / height) * 100,
    z: Number.isFinite(config.z) ? config.z : 0,
    scale,
  });
}
