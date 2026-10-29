import assert from 'node:assert/strict';
import test from 'node:test';
import { cp, mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { verifyStandaloneApps } from '../../scripts/standalone-verification/index.mjs';

const root = path.resolve(import.meta.dirname, '../..');
test('modular verifier accepts maintained products and rejects runtime damage', async t => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'canva-verifier-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  await cp(path.join(root, 'apps'), path.join(fixture, 'apps'), { recursive: true,
    filter: source => !['node_modules', 'dist', '__pycache__', '.pytest_cache'].includes(path.basename(source)),
  });
  await cp(path.join(root, 'scripts'), path.join(fixture, 'scripts'), { recursive: true });
  assert.deepEqual(verifyStandaloneApps(fixture), []);
  const target = path.join(fixture, 'apps/depthpop-canva/src/intents/design_editor/app.tsx');
  const original = await readFile(target, 'utf8');
  await writeFile(target, original + '\n// Media Library\n');
  assert.ok(verifyStandaloneApps(fixture).some(message => message.includes('forbidden cross-product')));
  await writeFile(target, original);

  const setupPath = path.join(fixture, 'apps/depthpop-canva/src/intents/design_editor/depthpop-setup.tsx');
  const setupSource = await readFile(setupPath, 'utf8');
  await writeFile(setupPath, setupSource.replace('productName="DepthPop"', 'productName="WrongProduct"'));
  assert.ok(verifyStandaloneApps(fixture).some(message => message.includes('local image upload product name')));
  await writeFile(setupPath, setupSource);
  await writeFile(target, original.replace('<DepthPopSetup', '<DisconnectedSetup'));
  assert.ok(verifyStandaloneApps(fixture).some(message => message.includes('execution/UI marker missing: <DepthPopSetup')));
  await writeFile(target, original);
  const holoAppPath = path.join(fixture, 'apps/holoforge-canva/src/intents/design_editor/app.tsx');
  const holoAppSource = await readFile(holoAppPath, 'utf8');
  await writeFile(holoAppPath, holoAppSource.replace('from "./studio-panels"', 'from "./unrelated-panels"'));
  assert.ok(verifyStandaloneApps(fixture).some(message => message.includes('runtime/UI marker missing: from "./studio-panels"')));
  await writeFile(holoAppPath, holoAppSource);
  const panelsPath = path.join(fixture, 'apps/holoforge-canva/src/intents/design_editor/studio-panels.tsx');
  const panelsSource = await readFile(panelsPath, 'utf8');
  await writeFile(panelsPath, panelsSource.replace('<HoloViewport', '<DisconnectedViewport'));
  assert.ok(verifyStandaloneApps(fixture).some(message => message.includes('studio panel marker missing: <HoloViewport')));
  await writeFile(panelsPath, panelsSource);
  const gltf = path.join(fixture, 'apps/depthpop-canva/backend/services/export_gltf.py');
  const source = await readFile(gltf, 'utf8');
  await writeFile(gltf, source.replaceAll('model/gltf-binary', 'invalid/mime'));
  assert.ok(verifyStandaloneApps(fixture).some(message => message.includes('model/gltf-binary')));
});
