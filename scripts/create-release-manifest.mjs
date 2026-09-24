import { readFile, writeFile } from 'node:fs/promises';

function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function commitSha(value) {
  const normalized = text(value, 'commit');
  if (!/^[a-f0-9]{40}$/iu.test(normalized)) {
    throw new TypeError('commit must be a 40-character Git SHA');
  }
  return normalized.toLowerCase();
}

const packageUrl = new URL('../package.json', import.meta.url);
const pkg = JSON.parse(await readFile(packageUrl, 'utf8'));
const version = text(pkg.version, 'package version');
if (!/^\d+\.\d+\.\d+$/u.test(version)) {
  throw new TypeError('package version must be a stable semantic version');
}

const requestedTag = text(process.argv[2] ?? process.env.RELEASE_TAG, 'release tag');
const expectedTag = `v${version}`;
if (requestedTag !== expectedTag) {
  throw new TypeError(`release tag must equal ${expectedTag}`);
}

const commit = commitSha(process.argv[3] ?? process.env.GITHUB_SHA);
const outputPath = text(process.argv[4] ?? 'release-manifest.json', 'output path');

const manifest = Object.freeze({
  schemaVersion: 1,
  tag: requestedTag,
  version,
  commit,
});

await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
process.stdout.write(`release manifest ready: ${requestedTag} @ ${commit}\n`);
