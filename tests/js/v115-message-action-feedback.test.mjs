import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUTHENTICATED_V115_ACTION_FEEDBACK,
  createActionFeedback,
} from '../../runtime/v115-action-feedback.mjs';
import { createAuthenticatedV115MessageActions } from '../../runtime/v115-authenticated-message-actions.mjs';

function feedbackEvents() {
  const events = [];
  return {
    events,
    feedback: {
      pending: (action) => events.push(['pending', action]),
      success: (action) => events.push(['success', action]),
      failure: (action) => events.push(['failure', action]),
    },
  };
}

function createActions(overrides = {}) {
  return createAuthenticatedV115MessageActions({
    clipboardWrite: async () => {},
    exportText: async () => {},
    schedule: () => {},
    getPreviousUserText: () => 'original user prompt',
    setPrompt: () => {},
    submit: async () => {},
    ...overrides,
  });
}

test('action feedback emits renderer-agnostic pending, success, and error states', () => {
  const events = [];
  const feedback = createActionFeedback({ notify: (event) => events.push(event) });

  feedback.pending('copy');
  feedback.success('copy');
  feedback.failure('share');

  assert.deepEqual(events, [
    { action: 'copy', status: 'pending', message: 'Working…' },
    { action: 'copy', status: 'success', message: 'Copied' },
    { action: 'share', status: 'error', message: 'Action could not be completed. Try again.' },
  ]);
  assert.equal(AUTHENTICATED_V115_ACTION_FEEDBACK.export, 'Export ready');
});

test('copy feedback preserves the authenticated success result shape', async () => {
  const { events, feedback } = feedbackEvents();
  const actions = createActions({ feedback });

  const result = await actions.perform({ action: 'copy', text: 'answer' });

  assert.deepEqual(result, { handled: true, action: 'copy' });
  assert.deepEqual(events, [
    ['pending', 'copy'],
    ['success', 'copy'],
  ]);
});

test('contained browser-action rejection reports failure without changing its return shape', async () => {
  const { events, feedback } = feedbackEvents();
  const actions = createActions({
    feedback,
    clipboardWrite: async () => {
      throw new Error('clipboard denied');
    },
  });

  const result = await actions.perform({ action: 'copy', text: 'answer' });

  assert.deepEqual(result, { handled: true, action: 'copy' });
  assert.deepEqual(events, [
    ['pending', 'copy'],
    ['failure', 'copy'],
  ]);
});

test('feedback renderer failure cannot break a successful authenticated action', async () => {
  let writes = 0;
  const actions = createActions({
    clipboardWrite: async () => {
      writes += 1;
    },
    feedback: {
      pending() {
        throw new Error('status surface unavailable');
      },
      success() {
        throw new Error('status surface unavailable');
      },
      failure() {
        throw new Error('status surface unavailable');
      },
    },
  });

  const result = await actions.perform({ action: 'copy', text: 'answer' });

  assert.equal(writes, 1);
  assert.deepEqual(result, { handled: true, action: 'copy' });
});

test('submit rejection remains observable while feedback receives the failure state', async () => {
  const { events, feedback } = feedbackEvents();
  const failure = new Error('request failed');
  const actions = createActions({
    feedback,
    submit: async () => {
      throw failure;
    },
  });

  await assert.rejects(() => actions.perform({ action: 'regen', wrap: {} }), failure);
  assert.deepEqual(events, [
    ['pending', 'regen'],
    ['failure', 'regen'],
  ]);
});
