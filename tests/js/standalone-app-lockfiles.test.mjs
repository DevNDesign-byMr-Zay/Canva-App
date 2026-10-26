import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL("../../" + relativePath, import.meta.url), "utf8"));
}

for (const app of ["depthpop-canva", "holoforge-canva"]) {
  test(`${app} has a committed v3 dependency lock consistent with its manifest`, async () => {
    const base = `apps/${app}/`;
    const manifest = await readJson(base + "package.json");
    const lock = await readJson(base + "package-lock.json");

    assert.equal(lock.lockfileVersion, 3);
    assert.equal(lock.name, manifest.name);
    assert.equal(lock.version, manifest.version);
    assert.equal(lock.packages[""].name, manifest.name);
    assert.equal(lock.packages[""].version, manifest.version);
    assert.deepEqual(lock.packages[""].dependencies, manifest.dependencies);
    assert.deepEqual(lock.packages[""].devDependencies, manifest.devDependencies);
    assert.deepEqual(lock.packages[""].engines, manifest.engines);
    assert.equal(manifest.scripts["test:coverage"], "vitest run --coverage");
    assert.equal(manifest.devDependencies["@vitest/coverage-v8"], lock.packages["node_modules/@vitest/coverage-v8"].version);

    // The locked version and resolution are mandatory for every first-party
    // runtime or build dependency. npm ci verifies nested transitive edges.
    for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })) {
      const entry = lock.packages[`node_modules/${name}`];
      assert.ok(entry, `missing locked direct dependency ${name} for ${app}`);
      assert.ok(entry.version, `unversioned dependency ${name} for ${app}`);
      assert.ok(entry.resolved || entry.link, `unresolved dependency ${name} for ${app}`);
    }
  });
}
