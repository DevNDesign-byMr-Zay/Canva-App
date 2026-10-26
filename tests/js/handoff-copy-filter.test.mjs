import assert from 'node:assert/strict';
import test from 'node:test';
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { includeBackendSource } from '../../scripts/backend-package-filter.mjs';

test('backend packages retain source modules and exclude caches, secrets and runtime data', async t => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'backend-copy-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const source = path.join(fixture, 'backend');
  for (const relative of ['services/export.py', '__pycache__/app.pyc', '.pytest_cache/state', '.env', 'data/jobs.db', 'outputs/private.png', 'README.md', '.env.example', 'requirements.lock.txt']) {
    const file = path.join(source, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, 'fixture');
  }
  const destination = path.join(fixture, 'out');
  await cp(source, destination, { recursive: true, filter: file => includeBackendSource(source, file) });
  assert.deepEqual((await readdir(destination)).sort(), ['.env.example', 'README.md', 'requirements.lock.txt', 'services']);
  assert.deepEqual(await readdir(path.join(destination, 'services')), ['export.py']);
});
