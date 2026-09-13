import { HOLO_RENDER_SCHEMA } from './renderer.mjs';

export const HOLO_MOUNT_SCHEMA = 'holo.mount.v1';

export function createCss3dMountAdapter({ document } = {}) {
  if (!document || typeof document.createElement !== 'function') {
    throw new TypeError('document.createElement is required');
  }

  const roots = new WeakMap();

  function render(root, model) {
    if (!root || !root.style || typeof root.appendChild !== 'function') {
      throw new TypeError('mount root is required');
    }
    if (!model || model.schema !== HOLO_RENDER_SCHEMA || !Array.isArray(model.layers)) {
      throw new TypeError('valid CSS3D render model is required');
    }

    let state = roots.get(root);
    if (!state) {
      const camera = document.createElement('div');
      camera.setAttribute('data-holo-camera', 'true');
      root.replaceChildren(camera);
      state = { camera, layers: new Map() };
      roots.set(root, state);
    }

    Object.assign(root.style, model.viewportStyle);
    Object.assign(state.camera.style, model.cameraStyle);

    const stale = new Set(state.layers.keys());
    const created = [];
    const reused = [];

    for (const layer of model.layers) {
      const id = String(layer.id);
      let element = state.layers.get(id);
      if (!element) {
        element = document.createElement('div');
        state.layers.set(id, element);
        created.push(id);
      } else {
        reused.push(id);
      }
      for (const [name, value] of Object.entries(layer.attributes ?? {})) {
        element.setAttribute(name, value);
      }
      Object.assign(element.style, layer.style ?? {});
      state.camera.appendChild(element);
      stale.delete(id);
    }

    const removed = [];
    for (const id of stale) {
      const element = state.layers.get(id);
      element.remove();
      state.layers.delete(id);
      removed.push(id);
    }

    return Object.freeze({
      schema: HOLO_MOUNT_SCHEMA,
      sceneId: model.sceneId,
      created: Object.freeze(created),
      reused: Object.freeze(reused),
      removed: Object.freeze(removed),
    });
  }

  return Object.freeze({ schema: HOLO_MOUNT_SCHEMA, render });
}
