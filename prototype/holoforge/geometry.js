function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function optionalFinite(value, name, fallback) {
  return value === undefined ? fallback : finite(value, name);
}

function normalizeSpatialNumber(value) {
  return Number(value.toFixed(12));
}

export function reconstructSourceConfig(candidateConfig = {}, delta = {}) {
  finite(candidateConfig.x, 'candidate x');
  finite(candidateConfig.y, 'candidate y');

  const candidateZ = optionalFinite(candidateConfig.z, 'candidate z', 0);
  const candidateScale = optionalFinite(candidateConfig.scale, 'candidate scale', 1);
  const deltaX = optionalFinite(delta.x, 'delta x', 0);
  const deltaY = optionalFinite(delta.y, 'delta y', 0);
  const deltaZ = optionalFinite(delta.z, 'delta z', 0);
  const deltaScale = optionalFinite(delta.scale, 'delta scale', 0);

  if (candidateScale <= 0) throw new TypeError('candidate scale must be positive');

  const sourceScale = normalizeSpatialNumber(candidateScale - deltaScale);
  if (sourceScale <= 0) {
    throw new TypeError('reconstructed source scale must be positive');
  }

  return Object.freeze({
    ...candidateConfig,
    x: normalizeSpatialNumber(candidateConfig.x - deltaX),
    y: normalizeSpatialNumber(candidateConfig.y - deltaY),
    z: normalizeSpatialNumber(candidateZ - deltaZ),
    scale: sourceScale,
  });
}

export function projectDesignConfig(config, { width = 600, height = 500 } = {}) {
  finite(config?.x, 'config x');
  finite(config?.y, 'config y');
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new TypeError('design dimensions must be positive finite numbers');
  }

  const z = optionalFinite(config.z, 'config z', 0);
  const scale = optionalFinite(config.scale, 'config scale', 1);
  if (scale <= 0) throw new TypeError('config scale must be positive');

  return Object.freeze({
    leftPercent: normalizeSpatialNumber((config.x / width) * 100),
    topPercent: normalizeSpatialNumber((config.y / height) * 100),
    z: normalizeSpatialNumber(z),
    scale: normalizeSpatialNumber(scale),
  });
}
