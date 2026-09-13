import { HOLO_FRAME_SCHEMA } from './interaction.mjs';

export const HOLO_RENDER_SCHEMA = 'holo.render.css3d.v1';

const DEFAULT_UNIT = 40;
const DEFAULT_PERSPECTIVE = 900;
const MIN_UNIT = 8;
const MAX_UNIT = 160;
const MIN_PERSPECTIVE = 240;
const MAX_PERSPECTIVE = 2400;

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function px(value) {
  const normalized = Math.abs(value) < 1e-9 ? 0 : value;
  return `${Number(normalized.toFixed(3))}px`;
}

function deg(value) {
  const normalized = Math.abs(value) < 1e-9 ? 0 : value;
  return `${Number(normalized.toFixed(3))}deg`;
}

function scale(value) {
  return Number(clamp(finite(value, 1), 0.05, 20).toFixed(4));
}

function validateFrame(frame) {
  if (!frame || frame.schema !== HOLO_FRAME_SCHEMA || !Array.isArray(frame.layers)) {
    throw new TypeError('A valid projected holographic frame is required.');
  }
  if (!frame.view || !frame.view.target) {
    throw new TypeError('Projected frame is missing camera state.');
  }
}

function layerTransform(layer, unit) {
  const position = layer.position ?? {};
  const transform = layer.transform ?? {};
  const x = finite(position.x) * unit;
  const y = -finite(position.y) * unit;
  const z = finite(position.z, finite(layer.depth)) * unit;

  return [
    `translate3d(${px(x)}, ${px(y)}, ${px(z)})`,
    `rotateX(${deg(finite(transform.rx))})`,
    `rotateY(${deg(finite(transform.ry))})`,
    `rotateZ(${deg(finite(transform.rz))})`,
    `scale(${scale(transform.scale)})`,
  ].join(' ');
}

export function buildCss3dRenderModel(
  frame,
  { unit = DEFAULT_UNIT, perspective = DEFAULT_PERSPECTIVE, motion = true } = {},
) {
  validateFrame(frame);

  const resolvedUnit = clamp(finite(unit, DEFAULT_UNIT), MIN_UNIT, MAX_UNIT);
  const resolvedPerspective = clamp(
    finite(perspective, DEFAULT_PERSPECTIVE),
    MIN_PERSPECTIVE,
    MAX_PERSPECTIVE,
  );
  const camera = frame.view;
  const target = camera.target;

  const cameraTransform = [
    `translate3d(${px(-finite(target.x) * resolvedUnit)}, ${px(finite(target.y) * resolvedUnit)}, ${px((-finite(target.z) - finite(camera.distance, 6)) * resolvedUnit)})`,
    `rotateX(${deg(finite(camera.pitch))})`,
    `rotateY(${deg(-finite(camera.yaw))})`,
  ].join(' ');

  const layers = frame.layers.map((layer, index) =>
    Object.freeze({
      id: layer.id,
      kind: layer.kind,
      selected: layer.selected === true,
      depth: finite(layer.depth),
      order: index,
      attributes: Object.freeze({
        'data-holo-layer': String(layer.id),
        'data-holo-kind': String(layer.kind ?? 'unknown'),
        'data-holo-selected': layer.selected === true ? 'true' : 'false',
      }),
      style: Object.freeze({
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: layerTransform(layer, resolvedUnit),
        transformStyle: 'preserve-3d',
        backfaceVisibility: 'hidden',
        willChange: motion ? 'transform' : 'auto',
        transition: motion ? 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
        zIndex: String(index + 1),
      }),
    }),
  );

  return Object.freeze({
    schema: HOLO_RENDER_SCHEMA,
    sceneId: frame.sceneId,
    selectedNodeId: frame.selectedNodeId,
    unit: resolvedUnit,
    perspective: resolvedPerspective,
    viewportStyle: Object.freeze({
      position: 'relative',
      overflow: 'hidden',
      perspective: px(resolvedPerspective),
      perspectiveOrigin: '50% 50%',
      transformStyle: 'preserve-3d',
    }),
    cameraStyle: Object.freeze({
      position: 'absolute',
      inset: '0',
      transform: cameraTransform,
      transformStyle: 'preserve-3d',
      willChange: motion ? 'transform' : 'auto',
      transition: motion ? 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
    }),
    layers: Object.freeze(layers),
  });
}
