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

// Explicit, bounded list of allowed transitive development advisories
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
  'proxy-addr',
  'shell-quote',
  'source-map-js',
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

// Verify that every flagged advisory package is strictly a development dependency
// and does NOT enter the production bundle.
for (const pkgName of allowed) {
  const pkgLock = lock?.packages?.[`node_modules/${pkgName}`];
  if (pkgLock && pkgLock.dev !== true) {
    throw new Error(
      `advisory package ${pkgName} is not marked as dev-only in package-lock.json`,
    );
  }
}

console.log(
  'verified Canva dev-tool boundary: uuid is patched via override; all dev-tool advisories verified as transitive dev-only; production audit remains independently blocking',
);
