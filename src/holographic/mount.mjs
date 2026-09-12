import { HOLO_RENDER_SCHEMA } from './renderer.mjs';

export const HOLO_MOUNT_SCHEMA = 'holo.mount.v1';

function validateModel(model) {
  if (!model || model.schema !== HOLO_RENDER_SCHEMA || !Array.isArray(model.layers)) {
    throw new TypeError('A valid CSS3D render model is required.');
  }
}

function applyStyle(element, style = {}) {
  for (const [name, value] of Object.entries(style)) {
    element.style[name] = value;
  }
}

function applyAttributes(element, attributes = {}) {
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
}

function removeElement(element) {
  if (typeof element.remove === 'function') {
    element.remove();
    return;
  }
  if (element.parentNode && typeof element.parentNode.removeChild === 'function') {
    element.parentNode.removeChild(element);
  }
}

export function createCss3dMountAdapter({ document, createLayer } = {}) {
  if (!document || typeof document.createElement !== 'function') {
    throw new TypeError('A document with createElement is required.');
  }
  if (createLayer !== undefined && typeof createLayer !== 'function') {
    throw new TypeError('createLayer must be a function when provided.');
  }

  const mounts = new WeakMap();

  function ensureMount(root) {
    if (!root || typeof root.appendChild !== 'function' || !root.style) {
      throw new TypeError('A DOM mount root is required.');
    }

    const existing = mounts.get(root);
    if (existing) return existing;

    const camera = document.createElement('div');
    camera.setAttribute('data-holo-camera', 'true');
    if (typeof root.replaceChildren === 'function') {
      root.replaceChildren(camera);
    } else {
      root.appendChild(camera);
    }

    const state = { camera, layers: new Map() };
    mounts.set(root, state);
    return state;
  }

  function render(root, model) {
    validateModel(model);
    const state = ensureMount(root);
    const stale = new Set(state.layers.keys());
    const created = [];
    const reused = [];
    const removed = [];

    applyStyle(root, model.viewportStyle);
    applyStyle(state.camera, model.cameraStyle);

    for (const layer of model.layers) {
      const id = String(layer.id);
      let element = state.layers.get(id);
      if (!element) {
        element = createLayer ? createLayer(layer, document) : document.createElement('div');
        if (!element || typeof element.setAttribute !== 'function' || !element.style) {
          throw new TypeError(`Invalid layer element for ${id}.`);
        }
        state.layers.set(id, element);
        created.push(id);
      } else {
        reused.push(id);
      }

      applyAttributes(element, layer.attributes);
      applyStyle(element, layer.style);
      state.camera.appendChild(element);
      stale.delete(id);
    }

    for (const id of stale) {
      removeElement(state.layers.get(id));
      state.layers.delete(id);
      removed.push(id);
    }

    return Object.freeze({
      schema: HOLO_MOUNT_SCHEMA,
      sceneId: model.sceneId,
      created: Object.freeze(created),
      reused: Object.freeze(reused),
      removed: Object.freeze(removed),
      mountedLayerIds: Object.freeze(model.layers.map((layer) => String(layer.id))),
    });
  }

  return Object.freeze({ schema: HOLO_MOUNT_SCHEMA, render });
}
