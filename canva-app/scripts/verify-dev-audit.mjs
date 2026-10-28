import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Existing vendor dev-server exception, reduced from thirteen package names.
// Production audit remains independently blocking. Never add new advisories here.
export function verifyDevelopmentAudit(audit, manifest, lock) {
  if (!audit?.vulnerabilities || typeof audit.vulnerabilities !== 'object') {
    throw new Error('A valid npm audit report is required');
  }
  if (manifest?.overrides?.uuid !== '11.1.1' ||
      lock?.packages?.['node_modules/uuid']?.version !== '11.1.1' ||
      lock.packages['node_modules/uuid'].dev !== true) {
    throw new Error('uuid must remain patched and dev-only at reviewed 11.1.1');
  }
  for (const [name, record] of Object.entries(audit.vulnerabilities)) {
    if (!['node-forge', '@canva/app-scripts'].includes(name) || record.severity !== 'high' || record.fixAvailable !== false) {
      throw new Error(`Unreviewed or fixable development vulnerability: ${name}; ${JSON.stringify({ severity: record.severity, fixAvailable: record.fixAvailable, via: record.via })}`);
    }
    if (!record.nodes?.length || record.nodes.some(node => lock.packages?.[node]?.dev !== true)) {
      throw new Error(`Vulnerability crosses the dev-only boundary: ${name}`);
    }
    if (!record.via?.length || record.via.some(via => name === 'node-forge'
      ? via?.url !== 'https://github.com/advisories/GHSA-86w9-cpqp-85rv'
      : via !== 'node-forge')) {
      throw new Error(`Unreviewed development advisory identity: ${name}`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const file = process.argv[2];
  if (!file) throw new TypeError('audit report path is required');
  const [audit, manifest, lock] = await Promise.all([
    readFile(file, 'utf8').then(JSON.parse),
    readFile('package.json', 'utf8').then(JSON.parse),
    readFile('package-lock.json', 'utf8').then(JSON.parse),
  ]);
  verifyDevelopmentAudit(audit, manifest, lock);
  console.log('Verified development audit: only the existing unfixable dev-only node-forge vendor boundary may remain.');
}
