import assert from 'node:assert/strict';
import test from 'node:test';

import { createActionFeedback } from '../../runtime/v115-action-feedback.mjs';

test('async host feedback rejection is contained', async () => {
  const feedback = createActionFeedback({
    notify: async () => { throw new Error('notification failed'); },
  });
  assert.doesNotThrow(() => feedback.pending('copy'));
  await new Promise((resolve) => setImmediate(resolve));
});

test('feedback validates host callbacks and preserves explicit fallback messages', () => {
  assert.throws(() => createActionFeedback(), /notify must be a function/);
  assert.throws(() => createActionFeedback({ notify() {}, clear: 'not-a-function' }), /clear must be a function/);

  const events = [];
  let clears = 0;
  const feedback = createActionFeedback({
    notify(event) { events.push(event); },
    clear() { clears += 1; },
  });
  feedback.success('unlisted-action');
  feedback.failure('copy', 'copy failed');
  feedback.clear();

  assert.deepEqual(events, [
    { action: 'unlisted-action', status: 'success', message: 'Done' },
    { action: 'copy', status: 'error', message: 'copy failed' },
  ]);
  assert.equal(clears, 1);
});
