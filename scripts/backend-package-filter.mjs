import path from 'node:path';
import { lstatSync } from 'node:fs';

const runtimeDirectories = new Set([
  '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache', '.git', '.venv',
  'venv', 'node_modules', 'coverage', 'data', '.artifacts', 'artifacts', 'artifact',
  'outputs', 'output', 'tmp', 'temp',
]);
const runtimeExtensions = new Set(['.pyc', '.pyo', '.sqlite', '.sqlite3', '.db', '.log']);

export function includeBackendSource(root, file) {
  const relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return false;
  if (relative.split(path.sep).some(part => runtimeDirectories.has(part))) return false;
  const basename = path.basename(file);
  if (basename.startsWith('.env') && !['.env.example', '.env.template'].includes(basename)) return false;
  if (runtimeExtensions.has(path.extname(file).toLowerCase())) return false;
  return !lstatSync(file).isSymbolicLink();
}
