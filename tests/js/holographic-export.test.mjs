import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createHolographicScene, exportHolographicScene } from '../../src/holographic/index.mjs';

describe('Canva holographic export', () => {
  test('serializes a scene with a versioned export contract', () => {
    const scene = createHolographicScene({
      id: 'canva-product',
      nodes: [{ id: 'hero', depth: 3 }],
    });
    const result = exportHolographicScene(scene);
    const payload = JSON.parse(result.content);

    assert.equal(result.format, 'json');
    assert.equal(result.mimeType, 'application/json');
    assert.equal(result.filename, 'canva-product.holo.json');
    assert.equal(payload.schema, 'canva.holographic-export.v1');
    assert.equal(payload.scene.id, 'canva-product');
  });

  test('rejects unsupported export formats and invalid scenes', () => {
    const scene = createHolographicScene({ id: 'demo' });
    assert.throws(() => exportHolographicScene(scene, { format: 'png' }), /Unsupported/);
    assert.throws(() => exportHolographicScene({}), /holo.scene.v1/);
  });
});
