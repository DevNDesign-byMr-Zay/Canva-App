import { readFile } from 'node:fs/promises';

const file = process.argv[2];
if (!file) throw new TypeError('audit report path is required');

const audit = JSON.parse(await readFile(file, 'utf8'));
const vulnerabilities = audit?.vulnerabilities ?? {};
const names = Object.keys(vulnerabilities).sort();
const allowed = [
  '@canva/app-scripts',
  'sockjs',
  'uuid',
  'webpack-dev-server',
].sort();

if (JSON.stringify(names) !== JSON.stringify(allowed)) {
  throw new Error(
    `unexpected development advisory set: expected ${allowed.join(', ')}, received ${names.join(', ') || 'none'}`,
  );
}

if (audit?.metadata?.vulnerabilities?.total !== 4) {
  throw new Error(`expected exactly 4 development advisory records, received ${audit?.metadata?.vulnerabilities?.total ?? 'unknown'}`);
}

for (const name of allowed) {
  const record = vulnerabilities[name];
  if (record?.severity !== 'moderate') {
    throw new Error(`${name} advisory severity changed from the reviewed moderate level`);
  }
  if (record?.fixAvailable !== false) {
    throw new Error(`${name} now reports a fix or a changed remediation shape; update dependencies instead of retaining the exception`);
  }
}

const uuid = vulnerabilities.uuid;
const advisory = Array.isArray(uuid?.via)
  ? uuid.via.find((item) => typeof item === 'object' && item?.url === 'https://github.com/advisories/GHSA-w5hq-g745-h8pq')
  : null;

if (!advisory) {
  throw new Error('reviewed uuid advisory GHSA-w5hq-g745-h8pq is not the source of the current dev-tool finding');
}

if (uuid?.isDirect !== false) {
  throw new Error('uuid must remain transitive; a direct vulnerable uuid dependency is not allowed');
}

const appScripts = vulnerabilities['@canva/app-scripts'];
if (appScripts?.isDirect !== true) {
  throw new Error('@canva/app-scripts must remain the reviewed direct development-tool root of this chain');
}

console.log('verified reviewed Canva development-tool advisory boundary; production audit remains independently blocking');
