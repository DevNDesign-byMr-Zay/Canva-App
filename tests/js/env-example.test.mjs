import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const envExample = new URL('.env.example', root);
const backendExamples = [
  new URL('apps/depthpop-canva/backend/.env.example', root),
  new URL('apps/holoforge-canva/backend/.env.example', root),
];
const deploymentValidator = new URL('scripts/verify-deployment-readiness.mjs', root);

function declaredKeys(source) {
  return new Set([...source.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((match) => match[1]));
}

test('root .env.example documents each maintained backend environment contract', async () => {
  const keys = declaredKeys(await readFile(envExample, 'utf8'));
  for (const backend of backendExamples) {
    const required = declaredKeys(await readFile(backend, 'utf8'));
    for (const key of required) {
      assert.ok(keys.has(key), `Missing ${key} from root .env.example (declared by ${backend.pathname})`);
    }
  }
});

test('root .env.example documents app-specific deployment aliases and settings', async () => {
  const keys = declaredKeys(await readFile(envExample, 'utf8'));
  const validator = await readFile(deploymentValidator, 'utf8');
  const direct = [...validator.matchAll(/env\.([A-Z][A-Z0-9_]+)/g)].map((match) => match[1]);
  const required = new Set([
    'CANVA_BACKEND_HOST',
    'CANVA_APP_ID', 'CANVA_APP_ORIGIN', 'REVIEW_CONTEXT_SOURCE_URL',
    'PORT', 'GITHUB_SHA', 'RELEASE_TAG',
    'DEPTHPOP_CANVA_APP_ID', 'DEPTHPOP_CANVA_APP_ORIGIN',
    'DEPTHPOP_PUBLIC_BASE_URL', 'DEPTHPOP_ENVIRONMENT',
    'HOLOFORGE_CANVA_APP_ID', 'HOLOFORGE_CANVA_APP_ORIGIN',
    'HOLOFORGE_PUBLIC_BASE_URL', 'HOLOFORGE_ENVIRONMENT',
    ...direct,
  ]);
  for (const key of required) assert.ok(keys.has(key), `Missing deployment env example key: ${key}`);
});

test('root .env.example contains no real credentials or duplicate definitions', async () => {
  const source = await readFile(envExample, 'utf8');
  const assignments = [...source.matchAll(/^([A-Z][A-Z0-9_]+)=(.*)$/gm)];
  const keys = assignments.map((match) => match[1]);
  assert.equal(new Set(keys).size, keys.length, 'every variable must be documented once');
  for (const match of assignments) {
    if (/(KEY|SECRET|TOKEN)$/.test(match[1])) {
      assert.equal(match[2].trim(), '', `credential value must be blank: ${match[1]}`);
    }
  }
});
