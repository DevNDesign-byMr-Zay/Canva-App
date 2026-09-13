import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionFeedback, AUTHENTICATED_V115_ACTION_FEEDBACK } from '../../runtime/v115-action-feedback.mjs';

test('emits explicit pending, success, and failure states', () => {
  const events = [];
  const feedback = createActionFeedback({
    notify: (event) => events.push(event),
  });

  feedback.pending('copy');
  feedback.success('copy');
  feedback.failure('share');

  assert.deepEqual(events, [
    { action: 'copy', status: 'pending', message: 'Working…' },
    { action: 'copy', status: 'success', message: 'Copied' },
    { action: 'share', status: 'error', message: 'Action could not be completed. Try again.' },
  ]);
});

test('keeps user-facing action labels centralized', () => {
  assert.equal(AUTHENTICATED_V115_ACTION_FEEDBACK.copy, 'Copied');
  assert.equal(AUTHENTICATED_V115_ACTION_FEEDBACK.export, 'Export ready');
});
