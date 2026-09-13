import { createHash } from 'node:crypto';

const CANVA_SNAPSHOT_VERSION = 1;

function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value)), 'utf8').digest('hex');
}

function projectElement(element, index) {
  if (!element || typeof element !== 'object') {
    throw new TypeError(`page.elements[${index}] must be an object`);
  }

  const geometry = {
    type: text(element.type, `page.elements[${index}].type`),
    top: finite(element.top, `page.elements[${index}].top`),
    left: finite(element.left, `page.elements[${index}].left`),
    width: finite(element.width, `page.elements[${index}].width`),
    height: finite(element.height, `page.elements[${index}].height`),
    rotation: finite(element.rotation, `page.elements[${index}].rotation`),
    transparency: finite(element.transparency, `page.elements[${index}].transparency`),
    locked: element.locked === true,
  };

  return deepFreeze({
    elementKey: `element-${String(index).padStart(4, '0')}-${digest(geometry).slice(0, 12)}`,
    ...geometry,
  });
}

export function buildCanvaCurrentPageSnapshot({ verifiedDesignId, page } = {}) {
  const designId = text(verifiedDesignId, 'verifiedDesignId');
  if (!page || typeof page !== 'object') throw new TypeError('page must be an object');
  if (page.type === 'unsupported') throw new TypeError('current Canva page is not supported');

  const pageId = text(page.id, 'page.id');
  const dimensions = page.dimensions;
  if (!dimensions || typeof dimensions !== 'object') {
    throw new TypeError('current Canva page must have bounded dimensions');
  }

  const pageWidth = finite(dimensions.width, 'page.dimensions.width');
  const pageHeight = finite(dimensions.height, 'page.dimensions.height');
  if (pageWidth <= 0 || pageHeight <= 0) {
    throw new TypeError('page dimensions must be greater than zero');
  }

  if (!page.elements || typeof page.elements.toArray !== 'function') {
    throw new TypeError('page.elements must expose toArray()');
  }

  const elements = page.elements.toArray().map(projectElement);
  const snapshotPayload = {
    snapshotVersion: CANVA_SNAPSHOT_VERSION,
    designId,
    page: {
      id: pageId,
      locked: page.locked === true,
      dimensions: { width: pageWidth, height: pageHeight },
      elements,
    },
  };
  const snapshotFingerprint = digest(snapshotPayload);

  return deepFreeze({
    snapshotVersion: CANVA_SNAPSHOT_VERSION,
    source: {
      designId,
      snapshotId: `canva-snapshot-${snapshotFingerprint.slice(0, 16)}`,
      pageIds: [pageId],
      snapshotFingerprint,
    },
    page: snapshotPayload.page,
    capabilities: {
      read: true,
      apply: false,
      reason: 'read-only HoloForge source snapshot',
    },
  });
}

export async function readCanvaCurrentPageSnapshot({ openDesign, verifiedDesignId } = {}) {
  if (typeof openDesign !== 'function') throw new TypeError('openDesign must be a function');
  text(verifiedDesignId, 'verifiedDesignId');

  let snapshot = null;
  await openDesign({ type: 'current_page' }, async (session) => {
    if (!session || typeof session !== 'object') throw new TypeError('Canva design session is required');
    snapshot = buildCanvaCurrentPageSnapshot({ verifiedDesignId, page: session.page });
  });

  if (!snapshot) throw new TypeError('openDesign did not provide a current page session');
  return snapshot;
}

export { CANVA_SNAPSHOT_VERSION };
