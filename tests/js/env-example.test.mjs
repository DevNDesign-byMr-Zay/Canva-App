import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ENV_EXAMPLE = new URL('../../.env.example', import.meta.url);

function declaredKeys(source) {
  return new Set(
    source
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => line.slice(0, line.indexOf('='))),
  );
}

test('.env.example documents backend and CI-only environment names', async () => {
  const keys = declaredKeys(await readFile(ENV_EXAMPLE, 'utf8'));
  for (const key of [
    'CANVA_APP_ID',
    'CANVA_APP_ORIGIN',
    'REVIEW_CONTEXT_SOURCE_URL',
    'PORT',
    'GITHUB_SHA',
    'RELEASE_TAG',
  ]) {
    assert.equal(keys.has(key), true, `missing environment example key: ${key}`);
  }
});
