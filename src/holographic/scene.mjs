export const HOLO_SCENE_SCHEMA = 'holo.scene.v1';

function requireMetadataObject(value, name) {
  if (value === undefined) return Object.freeze({});
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object.`);
  }
  return Object.freeze({ ...value });
}

function normalizeSceneNode(node, index) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    throw new TypeError(`Scene node ${index} must be an object.`);
  }
  if (typeof node.id !== 'string' || !node.id.trim()) {
    throw new TypeError(`Scene node ${index} id is required.`);
  }
  if (node.kind !== undefined && (typeof node.kind !== 'string' || !node.kind.trim())) {
    throw new TypeError(`Scene node ${index} kind must be a non-empty string.`);
  }
  if (node.depth !== undefined && !Number.isFinite(node.depth)) {
    throw new TypeError(`Scene node ${index} depth must be finite.`);
  }
  if (node.visible !== undefined && typeof node.visible !== 'boolean') {
    throw new TypeError(`Scene node ${index} visible must be a boolean.`);
  }

  return Object.freeze({
    id: node.id.trim(),
    kind: node.kind?.trim() || 'asset',
    depth: node.depth ?? 0,
    visible: node.visible !== false,
    transform: requireMetadataObject(node.transform, `Scene node ${index} transform`),
    animation: requireMetadataObject(node.animation, `Scene node ${index} animation`),
  });
}

export function createHolographicScene({
  id,
  title = '',
  nodes = [],
  exportProfile = 'simulator',
} = {}) {
  if (typeof id !== 'string' || !id.trim()) {
    throw new TypeError('Scene id is required.');
  }
  if (!Array.isArray(nodes)) throw new TypeError('Scene nodes must be an array.');
  return Object.freeze({
    schema: HOLO_SCENE_SCHEMA,
    id: id.trim(),
    title,
    exportProfile,
    nodes: Object.freeze(nodes.map(normalizeSceneNode)),
  });
}

export function planFromCanvaAssets(
  assets = [],
  { sceneId = 'canva-hologram', title = 'Canva Holographic Scene' } = {},
) {
  if (!Array.isArray(assets)) throw new TypeError('Assets must be an array.');
  return createHolographicScene({
    id: sceneId,
    title,
    nodes: assets.map((asset, index) => {
      if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
        throw new TypeError(`Asset ${index} must be an object.`);
      }
      return {
        id: asset.id ?? `asset-${index + 1}`,
        kind: asset.kind ?? 'asset',
        depth: asset.depth ?? index,
        visible: asset.visible,
        transform: asset.transform,
        animation: asset.animation,
      };
    }),
  });
}
