import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticatedV115MessageActions } from '../../runtime/v115-authenticated-message-actions.mjs';

test('reports action progress and failure instead of silently swallowing errors', async () => {
  const events = [];
  const feedback = {
    pending: (action) => events.push(['pending', action]),
    success: (action) => events.push(['success', action]),
    failure: (action) => events.push(['failure', action]),
  };
  const actions = createAuthenticatedV115MessageActions({
    feedback,
    clipboardWrite: async () => { throw new Error('clipboard unavailable'); },
    schedule: () => {},
    getPreviousUserText: () => '',
    setPrompt: () => {},
    submit: async () => {},
  });

  const result = await actions.perform({ action: 'copy', text: 'hello' });
  assert.equal(result.handled, true);
  assert.equal(result.error.message, 'clipboard unavailable');
  assert.deepEqual(events, [['pending', 'copy'], ['failure', 'copy']]);
});

test('successful actions emit a completion state', async () => {
  const events = [];
  const actions = createAuthenticatedV115MessageActions({
    feedback: {
      pending: (action) => events.push(['pending', action]),
      success: (action) => events.push(['success', action]),
      failure: (action) => events.push(['failure', action]),
    },
    clipboardWrite: async () => {},
    schedule: () => {},
    getPreviousUserText: () => '',
    setPrompt: () => {},
    submit: async () => {},
  });

  await actions.perform({ action: 'copy', text: 'hello' });
  assert.deepEqual(events, [['pending', 'copy'], ['success', 'copy']]);
});
