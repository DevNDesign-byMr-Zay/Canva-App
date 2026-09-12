import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createHolographicScene, exportHolographicScene } from '../../src/holographic/index.mjs';

describe('Canva holographic export', () => {
  test('serializes a versioned export with a display capability contract', () => {
    const scene = createHolographicScene({ id: 'canva-product', nodes: [{ id: 'hero', depth: 3 }] });
    const result = exportHolographicScene(scene);
    const payload = JSON.parse(result.content);
    assert.equal(result.format, 'json');
    assert.equal(payload.schema, 'canva.holographic-export.v1');
    assert.equal(payload.displayProfile, 'simulator');
    assert.equal(payload.displayProfileSchema, 'canva.holographic-display-profile.v1');
    assert.deepEqual(payload.capabilities, ['preview', 'deterministic-replay']);
  });

  test('rejects profile/target mismatches before producing an export', () => {
    const scene = createHolographicScene({ id: 'stage-show' });
    assert.equal(exportHolographicScene(scene, { target: 'projector-wall-a', displayProfile: 'projector' }).payload.displayProfile, 'projector');
    assert.throws(() => exportHolographicScene(scene, { target: 'projector-wall-a', displayProfile: 'simulator' }), /incompatible/);
    assert.throws(() => exportHolographicScene(scene, { target: 'simulator', displayProfile: 'holomat' }), /incompatible/);
  });

  test('rejects unsupported formats and invalid scene inputs', () => {
    const scene = createHolographicScene({ id: 'demo' });
    assert.throws(() => exportHolographicScene(scene, { format: 'png' }), /Unsupported/);
    assert.throws(() => exportHolographicScene(scene, { target: '' }), /target/);
    assert.throws(() => exportHolographicScene({}), /holo.scene.v1/);
  });
});
