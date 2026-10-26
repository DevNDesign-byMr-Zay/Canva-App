import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyDevelopmentAudit } from '../../canva-app/scripts/verify-dev-audit.mjs';

const manifest = { overrides: { uuid: '11.1.1' } };
const lock = { packages: { 'node_modules/uuid': { version: '11.1.1', dev: true }, 'node_modules/node-forge': { dev: true }, 'node_modules/@canva/app-scripts': { dev: true } } };
const reviewed = () => ({ vulnerabilities: {
  'node-forge': { severity: 'high', fixAvailable: false, nodes: ['node_modules/node-forge'], via: [{ url: 'https://github.com/advisories/GHSA-86w9-cpqp-85rv' }] },
  '@canva/app-scripts': { severity: 'high', fixAvailable: false, nodes: ['node_modules/@canva/app-scripts'], via: ['node-forge'] },
} });

test('accepts a clean graph or the narrow existing unfixable dev-only advisory', () => {
  assert.doesNotThrow(() => verifyDevelopmentAudit({ vulnerabilities: {} }, manifest, lock));
  assert.doesNotThrow(() => verifyDevelopmentAudit(reviewed(), manifest, lock));
});

for (const [name, mutate] of [
  ['new vulnerability', audit => { audit.vulnerabilities.vite = { severity: 'high' }; }],
  ['severity escalation', audit => { audit.vulnerabilities['node-forge'].severity = 'critical'; }],
  ['available fix', audit => { audit.vulnerabilities['node-forge'].fixAvailable = true; }],
  ['new advisory', audit => { audit.vulnerabilities['node-forge'].via.push({ url: 'https://github.com/advisories/unknown' }); }],
]) test(`rejects ${name} instead of widening the exception`, () => {
  const audit = reviewed(); mutate(audit);
  assert.throws(() => verifyDevelopmentAudit(audit, manifest, lock));
});

test('rejects production exposure, missing report and UUID override regression', () => {
  const runtime = structuredClone(lock); runtime.packages['node_modules/node-forge'].dev = false;
  assert.throws(() => verifyDevelopmentAudit(reviewed(), manifest, runtime));
  assert.throws(() => verifyDevelopmentAudit({}, manifest, lock));
  assert.throws(() => verifyDevelopmentAudit(reviewed(), { overrides: {} }, lock));
});
