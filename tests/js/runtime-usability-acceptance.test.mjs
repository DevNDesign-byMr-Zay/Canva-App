import assert from 'node:assert/strict';
import test from 'node:test';
import { createActionFeedback } from '../../runtime/v115-action-feedback.mjs';

test('renderer-agnostic runtime feedback exposes pending, success, and retryable error states', () => {
  const events = [];
  const feedback = createActionFeedback({ notify: (event) => events.push(event) });

  feedback.pending('copy', 'Copying…');
  feedback.success('copy');
  feedback.failure('export');

  assert.deepEqual(events, [
    { action: 'copy', status: 'pending', message: 'Copying…' },
    { action: 'copy', status: 'success', message: 'Copied' },
    { action: 'export', status: 'error', message: 'Action could not be completed. Try again.' },
  ]);
});

test('all maintained action types have deterministic success feedback', () => {
  const events = [];
  const feedback = createActionFeedback({ notify: (event) => events.push(event) });
  for (const action of ['copy', 'share', 'like', 'dislike', 'regen', 'branch', 'doublecheck', 'export', 'report']) {
    feedback.success(action);
  }
  assert.equal(events.length, 9);
  assert.equal(events.every((event) => event.status === 'success'), true);
  assert.equal(events.every((event) => typeof event.message === 'string' && event.message.length > 0), true);
});

test('presentation feedback failures cannot mutate or throw through host callbacks', async () => {
  const feedback = createActionFeedback({
    notify: async () => { throw new Error('host failed'); },
  });
  assert.doesNotThrow(() => feedback.pending('regen'));
  assert.doesNotThrow(() => feedback.failure('regen'));
  await new Promise((resolve) => setImmediate(resolve));
});
