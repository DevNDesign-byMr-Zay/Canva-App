import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const MAKEFILE = new URL('../../Makefile', import.meta.url);
const SCOPE = new URL('../../docs/PROJECT_SCOPE.md', import.meta.url);
const APP_PACKAGE = new URL('../../canva-app/package.json', import.meta.url);
const CLASSIFICATION = new URL('../../.repo-class.json', import.meta.url);

test('fresh-clone verification covers the complete Design Editor app contract', async () => {
  const makefile = await readFile(MAKEFILE, 'utf8');

  assert.match(makefile, /^app-check: audit-app typecheck-app test-app build-app$/mu);
  assert.match(makefile, /^verify-fresh: setup check app-check$/mu);
  assert.match(makefile, /npm --prefix canva-app audit --omit=dev --audit-level=moderate/u);
  assert.match(makefile, /verify-dev-audit\.mjs/u);
});

test('repository scope identifies the maintained application boundary', async () => {
  const scope = await readFile(SCOPE, 'utf8');
  const pkg = JSON.parse(await readFile(APP_PACKAGE, 'utf8'));
  const classification = JSON.parse(await readFile(CLASSIFICATION, 'utf8'));

  assert.match(scope, /application and developer tooling/u);
  assert.match(scope, /Canva Design Editor application/u);
  assert.match(scope, /not an infrastructure-as-code repository/u);
  assert.equal(classification.schemaVersion, 1);
  assert.equal(classification.primaryClass, 'application-tooling');
  assert.ok(classification.secondaryClasses.includes('frontend-application'));
  assert.ok(classification.excludedClasses.includes('infrastructure-as-code'));
  assert.ok(classification.maintainedSurfaces.includes('canva-app'));
  assert.equal(typeof pkg?.scripts?.typecheck, 'string');
  assert.equal(typeof pkg?.scripts?.test, 'string');
  assert.equal(typeof pkg?.scripts?.build, 'string');
});
