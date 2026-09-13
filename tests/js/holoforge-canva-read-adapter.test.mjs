import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCanvaCurrentPageSnapshot,
  readCanvaCurrentPageSnapshot,
} from '../../src/holoforge-canva-read-adapter.mjs';

function page(overrides = {}) {
  const elements = overrides.elements ?? [
    {
      type: 'text',
      top: 120,
      left: 80,
      width: 420,
      height: 90,
      rotation: 0,
      transparency: 1,
      locked: false,
    },
    {
      type: 'rect',
      top: 260,
      left: 120,
      width: 320,
      height: 180,
      rotation: 2,
      transparency: 0.85,
      locked: true,
    },
  ];

  return {
    type: 'absolute',
    id: 'page-001',
    locked: false,
    dimensions: { width: 1080, height: 1080 },
    elements: {
      toArray() {
        return elements;
      },
    },
    ...overrides,
  };
}

test('reads the current page without syncing or mutating Canva state', async () => {
  let requestedContext = null;
  let syncCalled = false;
  const currentPage = page();

  const openDesign = async (options, callback) => {
    requestedContext = options;
    await callback({
      page: currentPage,
      async sync() {
        syncCalled = true;
      },
    });
  };

  const snapshot = await readCanvaCurrentPageSnapshot({
    openDesign,
    verifiedDesignId: 'design-001',
  });

  assert.deepEqual(requestedContext, { type: 'current_page' });
  assert.equal(syncCalled, false);
  assert.equal(snapshot.source.designId, 'design-001');
  assert.equal(snapshot.source.pageIds[0], 'page-001');
  assert.match(snapshot.source.snapshotId, /^canva-snapshot-[a-f0-9]{16}$/);
  assert.match(snapshot.source.snapshotFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(snapshot.capabilities.read, true);
  assert.equal(snapshot.capabilities.apply, false);
  assert.equal(snapshot.page.elements.length, 2);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.page.elements), true);
});

test('produces the same source identity for equivalent page state', () => {
  const first = buildCanvaCurrentPageSnapshot({
    verifiedDesignId: 'design-001',
    page: page(),
  });
  const second = buildCanvaCurrentPageSnapshot({
    verifiedDesignId: 'design-001',
    page: page(),
  });

  assert.equal(first.source.snapshotId, second.source.snapshotId);
  assert.equal(first.source.snapshotFingerprint, second.source.snapshotFingerprint);
  assert.deepEqual(first.page, second.page);
});

test('changes snapshot identity when page geometry changes', () => {
  const original = buildCanvaCurrentPageSnapshot({
    verifiedDesignId: 'design-001',
    page: page(),
  });
  const changed = buildCanvaCurrentPageSnapshot({
    verifiedDesignId: 'design-001',
    page: page({
      elements: [
        {
          type: 'text',
          top: 121,
          left: 80,
          width: 420,
          height: 90,
          rotation: 0,
          transparency: 1,
          locked: false,
        },
      ],
    }),
  });

  assert.notEqual(original.source.snapshotFingerprint, changed.source.snapshotFingerprint);
  assert.notEqual(original.source.snapshotId, changed.source.snapshotId);
});

test('keeps the captured snapshot isolated from later caller mutation', () => {
  const element = {
    type: 'rect',
    top: 10,
    left: 20,
    width: 100,
    height: 50,
    rotation: 0,
    transparency: 1,
    locked: false,
  };
  const currentPage = page({ elements: [element] });
  const snapshot = buildCanvaCurrentPageSnapshot({
    verifiedDesignId: 'design-001',
    page: currentPage,
  });
  const fingerprint = snapshot.source.snapshotFingerprint;

  element.left = 999;
  currentPage.dimensions.width = 999;

  assert.equal(snapshot.source.snapshotFingerprint, fingerprint);
  assert.equal(snapshot.page.elements[0].left, 20);
  assert.equal(snapshot.page.dimensions.width, 1080);
});

test('fails closed on unsupported or unbounded pages', () => {
  assert.throws(
    () =>
      buildCanvaCurrentPageSnapshot({
        verifiedDesignId: 'design-001',
        page: { type: 'unsupported' },
      }),
    /not supported/,
  );

  assert.throws(
    () =>
      buildCanvaCurrentPageSnapshot({
        verifiedDesignId: 'design-001',
        page: page({ dimensions: undefined }),
      }),
    /bounded dimensions/,
  );
});
