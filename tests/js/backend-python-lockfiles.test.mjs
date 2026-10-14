import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function normalize(name) {
  return name.toLowerCase().replace(/[-_.]+/g, "-");
}

async function linesAt(relativePath) {
  const data = await readFile(new URL("../../" + relativePath, import.meta.url), "utf8");
  return data.split(/\r?\n/u).map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

for (const app of ["holoforge-canva", "depthpop-canva"]) {
  test(`${app}: verified Python lock pins all direct backend requirements`, async () => {
    const base = `apps/${app}/backend/`;
    const declared = await linesAt(base + "requirements.txt");
    const locked = await linesAt(base + "requirements.lock.txt");
    const packageNames = new Set();
    const versions = new Map();

    assert.ok(locked.length >= 30, `expected a complete transitive lock for ${app}`);
    for (const item of locked) {
      const match = /^([A-Za-z0-9][A-Za-z0-9._-]*)==([A-Za-z0-9.+!_-]+)$/u.exec(item);
      assert.ok(match, `unpinned or invalid locked requirement: ${item}`);
      const key = normalize(match[1]);
      assert.ok(!packageNames.has(key), `duplicate pinned package ${match[1]}`);
      packageNames.add(key);
      versions.set(key, match[2]);
    }
    for (const requirement of declared) {
      const name = /^([A-Za-z0-9][A-Za-z0-9._-]*)/u.exec(requirement)?.[1];
      assert.ok(name, `invalid source dependency: ${requirement}`);
      const key = normalize(name);
      assert.ok(packageNames.has(key), `missing lock pin for direct dependency ${name}`);
      const exact = /==([A-Za-z0-9.+!_-]+)/u.exec(requirement)?.[1];
      if (exact) assert.equal(versions.get(key), exact, `version changed for pinned source ${name}`);
    }
  });
}
