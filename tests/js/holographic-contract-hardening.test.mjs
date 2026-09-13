import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  SimulatorDisplayAdapter,
  composeCanvaPresentation,
  exportHolographicScene,
  planFromCanvaAssets,
} from '../../src/holographic/index.mjs';

test('rejects malformed Canva asset metadata at the holographic boundary', () => {
  assert.throws(
    () => planFromCanvaAssets([{ id: 'hero', depth: '4' }]),
    /depth must be finite/,
  );
  assert.throws(
    () => composeCanvaPresentation({ designId: 'demo', assets: [{ id: 'hero', transform: 'bad' }] }),
    /transform must be an object/,
  );
  assert.throws(
    () => composeCanvaPresentation({ designId: 'demo', assets: [{ id: '', visible: true }] }),
    /id is required/,
  );
});

test('execution and export receipts are deterministic for an equivalent scene', () => {
  const scene = composeCanvaPresentation({
    designId: 'poster-42',
    assets: [{ id: 'hero', kind: 'image', depth: 0.4 }],
  }).scene;
  const adapter = new SimulatorDisplayAdapter({ id: 'sim-1' });

  const firstExecution = adapter.execute(scene);
  const secondExecution = adapter.execute(scene);
  const firstExport = exportHolographicScene(scene);
  const secondExport = exportHolographicScene(scene);

  assert.deepEqual(secondExecution, firstExecution);
  assert.deepEqual(secondExport, firstExport);
  assert.equal(secondExport.content, firstExport.content);
});
