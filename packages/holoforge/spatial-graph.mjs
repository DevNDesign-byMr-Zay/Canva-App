/**
 * HOLOFORGE spatial graph v0.
 * Converts a bounded design snapshot into a deterministic 2.5D relationship graph.
 * No Canva API calls and no source-design mutation occur here.
 */

function finite(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be finite`);
  }
  return value;
}

function nonEmpty(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeElement(element, index) {
  if (!element || typeof element !== 'object' || Array.isArray(element)) {
    throw new TypeError(`elements[${index}] must be an object`);
  }

  const id = nonEmpty(element.id, `elements[${index}].id`);
  const x = finite(element.x, `elements[${index}].x`);
  const y = finite(element.y, `elements[${index}].y`);
  const width = finite(element.width, `elements[${index}].width`);
  const height = finite(element.height, `elements[${index}].height`);
  const z = element.z === undefined ? 0 : finite(element.z, `elements[${index}].z`);

  if (width < 0 || height < 0) {
    throw new RangeError(`elements[${index}] dimensions must be non-negative`);
  }

  return Object.freeze({ id, x, y, width, height, z });
}

export function createSpatialGraph({ designRef, elements } = {}) {
  const normalizedRef = nonEmpty(designRef, 'designRef');
  if (!Array.isArray(elements)) throw new TypeError('elements must be an array');

  const nodes = elements.map(normalizeElement);
  const ids = new Set();
  for (const node of nodes) {
    if (ids.has(node.id)) throw new TypeError(`duplicate element id: ${node.id}`);
    ids.add(node.id);
  }

  const relationships = [];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      const aRight = a.x + a.width;
      const aBottom = a.y + a.height;
      const bRight = b.x + b.width;
      const bBottom = b.y + b.height;
      const overlapX = Math.max(0, Math.min(aRight, bRight) - Math.max(a.x, b.x));
      const overlapY = Math.max(0, Math.min(aBottom, bBottom) - Math.max(a.y, b.y));
      const overlapArea = overlapX * overlapY;
      const centerDistance = Math.hypot((a.x + a.width / 2) - (b.x + b.width / 2), (a.y + a.height / 2) - (b.y + b.height / 2));

      relationships.push(Object.freeze({
        source: a.id,
        target: b.id,
        overlapArea,
        centerDistance,
        depthDelta: Math.abs(a.z - b.z),
      }));
    }
  }

  return Object.freeze({
    schema: 'holoforge.spatial-graph',
    version: '0',
    designRef: normalizedRef,
    nodes: Object.freeze(nodes),
    relationships: Object.freeze(relationships),
  });
}
