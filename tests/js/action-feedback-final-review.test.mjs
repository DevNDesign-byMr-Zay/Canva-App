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
