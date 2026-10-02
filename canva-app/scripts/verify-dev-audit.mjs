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
const allowed = ['@canva/app-scripts', 'node-forge'].sort();

if (JSON.stringify(names) !== JSON.stringify(allowed)) {
  throw new Error(
    `unexpected development advisory set: expected ${allowed.join(', ')}, received ${names.join(', ') || 'none'}`,
  );
}

if (audit?.metadata?.vulnerabilities?.total !== 2) {
  throw new Error(
    `expected exactly 2 development advisory records, received ${audit?.metadata?.vulnerabilities?.total ?? 'unknown'}`,
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
if (nodeForge?.fixAvailable !== false) {
  throw new Error(
    'node-forge now reports a fix; update the dependency instead of retaining the temporary dev-tool exception',
  );
}
if (nodeForge?.isDirect !== false) {
  throw new Error(
    'node-forge must remain transitive through Canva development tooling',
  );
}

const forgeAdvisory = Array.isArray(nodeForge?.via)
  ? nodeForge.via.find(
      (item) =>
        typeof item === 'object' &&
        item?.url === 'https://github.com/advisories/GHSA-86w9-cpqp-85rv',
    )
  : null;

if (!forgeAdvisory) {
  throw new Error(
    'reviewed node-forge advisory GHSA-86w9-cpqp-85rv is not the source of the current dev-tool finding',
  );
}

const lockedForge = lock?.packages?.['node_modules/node-forge'];
if (
  lockedForge?.version !== '1.4.0' ||
  lockedForge?.dev !== true
) {
  throw new Error(
    'node-forge must remain pinned to reviewed dev-only version 1.4.0 until an upstream patched release is available',
  );
}

const appScripts = vulnerabilities['@canva/app-scripts'];
if (appScripts?.severity !== 'high') {
  throw new Error(
    '@canva/app-scripts severity changed from the reviewed high meta-vulnerability level',
  );
}
if (appScripts?.fixAvailable !== false) {
  throw new Error(
    '@canva/app-scripts now reports a fix; update the development toolchain instead of retaining the exception',
  );
}
if (appScripts?.isDirect !== true) {
  throw new Error(
    '@canva/app-scripts must remain the reviewed direct development-tool root of this chain',
  );
}
if (
  !Array.isArray(appScripts?.via) ||
  appScripts.via.length !== 1 ||
  appScripts.via[0] !== 'node-forge'
) {
  throw new Error(
    '@canva/app-scripts must remain affected only through the reviewed node-forge chain',
  );
}

console.log(
  'verified Canva dev-tool boundary: uuid is patched via override; only the reviewed unpatched node-forge chain remains; production audit remains independently blocking',
);
