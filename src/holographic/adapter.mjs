import { createHolographicScene } from './scene.mjs';

export class SimulatorDisplayAdapter {
  constructor({ id = 'simulator', capabilities = ['depth', 'animation', 'multisurface'] } = {}) {
    this.device = Object.freeze({ id, type: 'simulator', capabilities: Object.freeze([...capabilities]) });
  }

  execute(scene) {
    if (!scene || scene.schema !== 'holo.scene.v1') throw new TypeError('A holo.scene.v1 scene is required.');
    return Object.freeze({
      receiptId: `sim-${scene.id}`,
      deviceId: this.device.id,
      sceneId: scene.id,
      nodeCount: scene.nodes.length,
      status: 'simulated',
    });
  }
}

export function composeCanvaPresentation({ designId, assets = [], title } = {}) {
  if (typeof designId !== 'string' || !designId.trim()) throw new TypeError('designId is required.');
  const scene = createHolographicScene({
    id: `canva-${designId}`,
    title: title ?? `Holographic presentation: ${designId}`,
    exportProfile: 'canva-holographic-v1',
    nodes: assets,
  });
  return Object.freeze({ source: Object.freeze({ provider: 'canva', designId }), scene });
}
