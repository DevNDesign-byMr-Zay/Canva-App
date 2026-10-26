import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlan, executePlan } from '../../scripts/verify-fresh-clone.mjs';

for (const platform of ['linux', 'win32']) {
  test(`complete bootstrap isolates backend environments on ${platform}`, () => {
    const plan = createPlan({ root: '/repo', python: 'python', platform });
    for (const app of ['holoforge-canva', 'depthpop-canva']) {
      const backend = plan.filter(step => step.cwd.endsWith(`apps/${app}/backend`));
      assert.ok(backend.some(step => step.args.includes('requirements.lock.txt')));
      assert.ok(backend.some(step => step.args.includes('pytest')));
      assert.ok(backend.some(step => step.args.includes('check')));
      const install = backend.find(step => step.args.includes('requirements.lock.txt'));
      assert.match(install.command, new RegExp(app));
      assert.ok(install.command.endsWith(platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'));
      const frontend = plan.filter(step => step.cwd.endsWith(`apps/${app}`));
      for (const command of ['ci', 'typecheck', 'test', 'build']) {
        assert.ok(frontend.some(step => step.args.includes(command)), `${app}: ${command}`);
      }
    }
    assert.ok(plan.some(step => step.args.includes('scripts/verify-canva-handoff-integrity.mjs')));
    assert.ok(plan.some(step => step.args.includes('scripts/smoke-canva-preview-browser.mjs')));
    assert.ok(plan.some(step => step.args.includes('canva-app')));
  });
}

test('standalone mode excludes root installations and still packages both apps', () => {
  const plan = createPlan({ root: '/repo', standalone: true });
  assert.ok(!plan.some(step => step.label === 'Install root Node dependencies'));
  assert.ok(plan.some(step => step.args.includes('scripts/package-independent-canva-apps.mjs')));
});

test('runner aborts at the failing step and identifies its context', () => {
  const seen = [];
  const plan = [1, 2, 3].map(n => ({ label: `step ${n}`, command: 'npm', args: [], cwd: '/repo' }));
  assert.throws(() => executePlan(plan, (cmd, args, options) => {
    seen.push(options.cwd);
    return { status: seen.length === 2 ? 12 : 0 };
  }, () => {}), /step 2.*12/);
  assert.equal(seen.length, 2);
});

test('runner reports missing executables and interrupted commands', () => {
  const plan = [{ label: 'build', command: 'missing', args: [], cwd: '/repo' }];
  assert.throws(() => executePlan(plan, () => ({ error: new Error('ENOENT') }), () => {}), /build.*ENOENT/);
  assert.throws(() => executePlan(plan, () => ({ status: null, signal: 'SIGTERM' }), () => {}), /build.*SIGTERM/);
});
