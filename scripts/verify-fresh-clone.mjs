// Cross-platform verification from committed locks. No shared backend environment.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function createPlan({ root = process.cwd(), python = process.env.PYTHON || 'python', platform = process.platform, standalone = false } = {}) {
  const plan = [];
  const npm = platform === 'win32' ? 'npm.cmd' : 'npm';
  const add = (label, command, args, cwd = root) => plan.push({ label, command, args, cwd });
  const environment = (name, cwd, lock) => {
    const directory = path.join(root, '.venv', name);
    const executable = path.join(directory, platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    add(`Create isolated ${name} Python environment`, python, ['-m', 'venv', directory]);
    add(`Install ${name} locked dependencies`, executable, ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', lock], cwd);
    add(`Check ${name} dependency graph`, executable, ['-m', 'pip', 'check'], cwd);
    return executable;
  };
  if (!standalone) {
    add('Install root Node dependencies', npm, ['ci', '--ignore-scripts']);
    const tooling = environment('tooling', root, 'requirements.lock.txt');
    for (const command of ['verify:release', 'verify:syntax', 'test', 'deployment:check:ci']) {
      add(`Root ${command}`, npm, ['run', command]);
    }
    add('Root Python lint', tooling, ['-m', 'ruff', 'check', 'archive_verifier', 'scripts', 'tests']);
    add('Root Python types', tooling, ['-m', 'mypy', 'archive_verifier', 'scripts']);
    add('Root Python tests', tooling, ['-m', 'coverage', 'run', '-m', 'pytest', '-q']);
    add('Root Python coverage', tooling, ['-m', 'coverage', 'report', '--fail-under=90']);
    add('Authenticated archive integrity', tooling, ['-m', 'archive_verifier']);
    add('Install compatibility editor', npm, ['--prefix', 'canva-app', 'ci', '--ignore-scripts']);
    for (const command of ['lint', 'typecheck', 'test:coverage', 'build']) {
      add(`Compatibility editor ${command}`, npm, ['--prefix', 'canva-app', 'run', command]);
    }
  }
  for (const app of ['holoforge-canva', 'depthpop-canva']) {
    const frontend = path.join(root, 'apps', app);
    add(`Install ${app} locked frontend`, npm, ['ci', '--ignore-scripts'], frontend);
    for (const command of ['typecheck', 'test', 'test:coverage', 'build']) {
      add(`${app} ${command}`, npm, ['run', command], frontend);
    }
    const backend = path.join(frontend, 'backend');
    const executable = environment(app, backend, 'requirements.lock.txt');
    add(`${app} Python compile`, executable, ['-m', 'compileall', '-q', '.'], backend);
    add(`${app} backend tests (no paid credentials required)`, executable, ['-m', 'pytest', '-q'], backend);
  }
  for (const script of ['verify-standalone-canva-apps.mjs', 'smoke-canva-preview-browser.mjs']) {
    add(script, process.execPath, [`scripts/${script}`]);
  }
  const output = '.artifacts/fresh-clone';
  add('Package independent Canva apps', process.execPath, ['scripts/package-independent-canva-apps.mjs', output]);
  add('Verify independent package integrity', process.execPath, ['scripts/verify-canva-handoff-integrity.mjs', output]);
  // shutil.make_archive is available on Windows and Ubuntu, unlike a zip shell command.
  add('Create independent ZIP archives', python, ['-c',
    'import pathlib, shutil; root = pathlib.Path(".artifacts/fresh-clone"); ' +
    '[shutil.make_archive(str(root / name), "zip", root / name) for name in ("holoforge-canva", "depthpop-canva")]']);
  return plan;
}

export function executePlan(plan, run = spawnSync, log = console.log) {
  for (const step of plan) {
    log(`\n[verify-fresh] ${step.label}`);
    // npm.cmd needs cmd.exe on Windows; arguments here are fixed, not shell input.
    const result = run(step.command, step.args, {
      cwd: step.cwd, stdio: 'inherit', shell: step.command.endsWith('.cmd'),
    });
    if (result.error || result.status !== 0) {
      throw new Error(`${step.label} failed in ${step.cwd}: ${result.error?.message || result.signal || `exit ${result.status}`}`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const unknown = process.argv.slice(2).filter(arg => arg !== '--standalone');
  if (unknown.length) throw new Error(`Unknown options: ${unknown.join(', ')}. Use --standalone or no options.`);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  executePlan(createPlan({ root, standalone: process.argv.includes('--standalone') }));
}
