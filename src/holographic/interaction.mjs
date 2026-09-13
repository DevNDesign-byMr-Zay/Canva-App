import { HOLO_SCENE_SCHEMA } from './scene.mjs';

export const HOLO_VIEW_SCHEMA = 'holo.view.v1';
export const HOLO_FRAME_SCHEMA = 'holo.frame.v1';

const MIN_DISTANCE = 1;
const MAX_DISTANCE = 40;
const MIN_PITCH = -85;
const MAX_PITCH = 85;
const MAX_TARGET_AXIS = 100;

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeYaw(value) {
  const wrapped = ((value + 180) % 360 + 360) % 360 - 180;
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

function validateScene(scene) {
  if (!scene || scene.schema !== HOLO_SCENE_SCHEMA || !Array.isArray(scene.nodes)) {
    throw new TypeError('A valid holographic scene is required.');
  }
}

function visibleNode(scene, nodeId) {
  const node = scene.nodes.find((candidate) => candidate.id === nodeId);
  if (!node || node.visible === false) {
    throw new RangeError(`Visible scene node not found: ${nodeId}`);
  }
  return node;
}

function targetFromNode(node) {
  const transform = node.transform ?? {};
  return Object.freeze({
    x: finite(transform.x),
    y: finite(transform.y),
    z: finite(transform.z, finite(node.depth)),
  });
}

function freezeView({ sceneId, yaw, pitch, distance, target, selectedNodeId }) {
  return Object.freeze({
    schema: HOLO_VIEW_SCHEMA,
    sceneId,
    camera: Object.freeze({
      yaw: normalizeYaw(yaw),
      pitch: clamp(pitch, MIN_PITCH, MAX_PITCH),
      distance: clamp(distance, MIN_DISTANCE, MAX_DISTANCE),
      target: Object.freeze({
        x: clamp(target.x, -MAX_TARGET_AXIS, MAX_TARGET_AXIS),
        y: clamp(target.y, -MAX_TARGET_AXIS, MAX_TARGET_AXIS),
        z: clamp(target.z, -MAX_TARGET_AXIS, MAX_TARGET_AXIS),
      }),
    }),
    selectedNodeId: selectedNodeId ?? null,
  });
}

export function createHolographicViewState(
  scene,
  {
    yaw = 0,
    pitch = -8,
    distance = 6,
    target = {},
    selectedNodeId = null,
  } = {},
) {
  validateScene(scene);
  if (selectedNodeId !== null) visibleNode(scene, selectedNodeId);

  return freezeView({
    sceneId: scene.id,
    yaw: finite(yaw),
    pitch: finite(pitch, -8),
    distance: finite(distance, 6),
    target: {
      x: finite(target.x),
      y: finite(target.y),
      z: finite(target.z),
    },
    selectedNodeId,
  });
}

export function applyHolographicInteraction(scene, view, action = {}) {
  validateScene(scene);
  if (!view || view.schema !== HOLO_VIEW_SCHEMA || view.sceneId !== scene.id) {
    throw new TypeError('View state must belong to the supplied scene.');
  }
  if (!action || typeof action.type !== 'string') {
    throw new TypeError('Interaction action type is required.');
  }

  const camera = view.camera;
  const next = {
    sceneId: scene.id,
    yaw: camera.yaw,
    pitch: camera.pitch,
    distance: camera.distance,
    target: { ...camera.target },
    selectedNodeId: view.selectedNodeId,
  };

  switch (action.type) {
    case 'orbit':
      next.yaw += finite(action.deltaYaw);
      next.pitch += finite(action.deltaPitch);
      break;
    case 'zoom':
      next.distance += finite(action.delta);
      break;
    case 'pan':
      next.target.x += finite(action.x);
      next.target.y += finite(action.y);
      next.target.z += finite(action.z);
      break;
    case 'select':
      visibleNode(scene, action.nodeId);
      next.selectedNodeId = action.nodeId;
      break;
    case 'focus': {
      const node = visibleNode(scene, action.nodeId);
      next.selectedNodeId = action.nodeId;
      next.target = { ...targetFromNode(node) };
      break;
    }
    case 'clear-selection':
      next.selectedNodeId = null;
      break;
    default:
      throw new RangeError(`Unsupported holographic interaction: ${action.type}`);
  }

  return freezeView(next);
}

export function projectHolographicFrame(scene, view) {
  validateScene(scene);
  if (!view || view.schema !== HOLO_VIEW_SCHEMA || view.sceneId !== scene.id) {
    throw new TypeError('View state must belong to the supplied scene.');
  }

  const layers = scene.nodes
    .filter((node) => node.visible !== false)
    .map((node) =>
      Object.freeze({
        id: node.id,
        kind: node.kind,
        depth: finite(node.depth),
        selected: node.id === view.selectedNodeId,
        position: targetFromNode(node),
        transform: node.transform,
        animation: node.animation,
      }),
    )
    .sort((left, right) => left.depth - right.depth || String(left.id).localeCompare(String(right.id)));

  return Object.freeze({
    schema: HOLO_FRAME_SCHEMA,
    sceneId: scene.id,
    view: view.camera,
    selectedNodeId: view.selectedNodeId,
    layers: Object.freeze(layers),
  });
}
