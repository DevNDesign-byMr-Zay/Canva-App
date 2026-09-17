import assert from 'node:assert/strict';
import test from 'node:test';

import { createActionFeedback } from '../../runtime/v115-action-feedback.mjs';

const ACTIONS = Object.freeze([
  'copy',
  'share',
  'like',
  'dislike',
  'regen',
  'branch',
  'doublecheck',
  'export',
  'report',
]);

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

test('all maintained action types have deterministic non-empty success feedback', () => {
  const events = [];
  const feedback = createActionFeedback({ notify: (event) => events.push(event) });

  for (const action of ACTIONS) feedback.success(action);

  assert.equal(events.length, ACTIONS.length);
  assert.equal(events.every((event) => event.status === 'success'), true);
  assert.equal(events.every((event) => typeof event.message === 'string' && event.message.length > 0), true);
});

test('host callback failures never escape through presentation feedback', async () => {
  const syncFailure = createActionFeedback({
    notify: () => {
      throw new Error('sync host failed');
    },
  });
  const asyncFailure = createActionFeedback({
    notify: async () => {
      throw new Error('async host failed');
    },
  });

  assert.doesNotThrow(() => syncFailure.pending('regen'));
  assert.doesNotThrow(() => syncFailure.failure('regen'));
  assert.doesNotThrow(() => asyncFailure.pending('regen'));
  assert.doesNotThrow(() => asyncFailure.failure('regen'));

  await new Promise((resolve) => setImmediate(resolve));
});
