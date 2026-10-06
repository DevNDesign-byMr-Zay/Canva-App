import { readFile } from 'node:fs/promises';

const file = process.argv[2];
if (!file) throw new TypeError('audit report path is required');

const [audit, manifest, lock] = await Promise.all([
  readFile(file, 'utf8').then(JSON.parse),
  readFile('package.json', 'utf8').then(JSON.parse),
  readFile('package-lock.json', 'utf8').then(JSON.parse),
]);

const vulnerabilities = audit?.vulnerabilities ?? {};
const names = Object.keys(vulnerabilities).sort();
const allowed = [
  '@canva/app-scripts',
  '@formatjs/cli-lib',
  'braces',
  'chokidar',
  'fast-glob',
  'http-proxy-middleware',
  'micromatch',
  'node-forge',
  'nodemon',
  'webpack-dev-server',
].sort();

if (JSON.stringify(names) !== JSON.stringify(allowed)) {
  throw new Error(
    `unexpected development advisory set: expected ${allowed.join(', ')}, received ${names.join(', ') || 'none'}`,
  );
}

if (typeof audit?.metadata?.vulnerabilities?.total !== 'number' || audit.metadata.vulnerabilities.total < 1) {
  throw new Error(
    `expected development advisory records, received ${audit?.metadata?.vulnerabilities?.total ?? 'unknown'}`,
  );
}

if (manifest?.overrides?.uuid !== '11.1.1') {
  throw new Error(
    'uuid security override must remain pinned to patched 11.1.1',
  );
}

const lockedUuid = lock?.packages?.['node_modules/uuid'];
if (
  lockedUuid?.version !== '11.1.1' ||
  lockedUuid?.dev !== true
) {
  throw new Error(
    'uuid must remain locked to reviewed dev-only version 11.1.1',
  );
}

const nodeForge = vulnerabilities['node-forge'];
if (nodeForge?.severity !== 'high') {
  throw new Error(
    'node-forge advisory severity changed from the reviewed high level',
  );
}

const appScripts = vulnerabilities['@canva/app-scripts'];
if (appScripts?.severity !== 'high') {
  throw new Error(
    '@canva/app-scripts severity changed from the reviewed high meta-vulnerability level',
  );
}

console.log(
  'verified Canva dev-tool boundary: uuid is patched via override; development advisories reviewed; production audit remains independently blocking',
);
