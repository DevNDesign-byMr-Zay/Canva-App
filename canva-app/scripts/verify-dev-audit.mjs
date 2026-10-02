import { readFile } from 'node:fs/promises';

const file = process.argv[2];
if (!file) throw new TypeError('audit report path is required');

const audit = JSON.parse(await readFile(file, 'utf8'));
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const vulnerabilities = audit?.vulnerabilities ?? {};
const names = Object.keys(vulnerabilities).sort();
const allowed = [
  '@canva/app-scripts',
  'node-forge',
  'sockjs',
  'uuid',
  'webpack-dev-server',
].sort();

console.log(
  'current reviewed dev audit shape:',
  JSON.stringify(
    Object.fromEntries(
      allowed.map((name) => {
        const record = vulnerabilities[name];
        return [
          name,
          {
            severity: record?.severity ?? null,
            isDirect: record?.isDirect ?? null,
            fixAvailable: record?.fixAvailable ?? null,
            via: record?.via ?? null,
          },
        ];
      }),
    ),
  ),
);

if (JSON.stringify(names) !== JSON.stringify(allowed)) {
  throw new Error(
    `unexpected development advisory set: expected ${allowed.join(', ')}, received ${names.join(', ') || 'none'}`,
  );
}

if (audit?.metadata?.vulnerabilities?.total !== 5) {
  throw new Error(
    `expected exactly 5 development advisory records, received ${audit?.metadata?.vulnerabilities?.total ?? 'unknown'}`,
  );
}

for (const name of ['sockjs', 'uuid', 'webpack-dev-server']) {
  const record = vulnerabilities[name];
  if (record?.severity !== 'moderate') {
    throw new Error(
      `${name} advisory severity changed from the reviewed moderate level`,
    );
  }
  if (record?.fixAvailable !== false) {
    throw new Error(
      `${name} now reports a fix or a changed remediation shape; update dependencies instead of retaining the exception`,
    );
  }
}

const nodeForge = vulnerabilities['node-forge'];
if (nodeForge?.severity !== 'high') {
  throw new Error('node-forge advisory severity changed from the reviewed high level');
}
if (nodeForge?.fixAvailable !== false) {
  throw new Error(
    'node-forge now reports a fix; update the dependency instead of retaining the temporary dev-tool exception',
  );
}
if (nodeForge?.isDirect !== false) {
  throw new Error('node-forge must remain transitive through Canva development tooling');
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

const uuid = vulnerabilities.uuid;
const uuidAdvisory = Array.isArray(uuid?.via)
  ? uuid.via.find(
      (item) =>
        typeof item === 'object' &&
        item?.url === 'https://github.com/advisories/GHSA-w5hq-g745-h8pq',
    )
  : null;

if (!uuidAdvisory) {
  throw new Error(
    'reviewed uuid advisory GHSA-w5hq-g745-h8pq is not the source of the current dev-tool finding',
  );
}

if (uuid?.isDirect !== false) {
  throw new Error(
    'uuid must remain transitive; a direct vulnerable uuid dependency is not allowed',
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

console.log(
  'verified reviewed Canva development-tool advisory boundary; production audit remains independently blocking',
);
