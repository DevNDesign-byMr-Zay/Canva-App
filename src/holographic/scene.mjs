export const HOLO_SCENE_SCHEMA = 'holo.scene.v1';

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
    id,
    title,
    exportProfile,
    nodes: Object.freeze(
      nodes.map((node) =>
        Object.freeze({
          id: node.id,
          kind: node.kind ?? 'asset',
          depth: Number.isFinite(node.depth) ? node.depth : 0,
          visible: node.visible !== false,
          transform: Object.freeze({ ...(node.transform ?? {}) }),
          animation: Object.freeze({ ...(node.animation ?? {}) }),
        }),
      ),
    ),
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
    nodes: assets.map((asset, index) => ({
      id: asset.id ?? `asset-${index + 1}`,
      kind: asset.kind ?? 'asset',
      depth: asset.depth ?? index,
      visible: asset.visible,
      transform: asset.transform,
      animation: asset.animation,
    })),
  });
}
