import { HOLO_SCENE_SCHEMA } from './scene.mjs';

export function simulateHolographicScene(scene, { targetId = 'simulator' } = {}) {
  if (!scene || scene.schema !== HOLO_SCENE_SCHEMA) {
    throw new TypeError('A valid holographic scene is required.');
  }
  if (typeof targetId !== 'string' || !targetId.trim()) {
    throw new TypeError('Target id is required.');
  }
  return Object.freeze({
    targetId: targetId.trim(),
    sceneId: scene.id,
    schema: scene.schema,
    status: 'simulated',
    renderedNodes: scene.nodes.filter((node) => node.visible !== false).map((node) => node.id),
  });
}
