import test from 'node:test';
import assert from 'node:assert/strict';

import { replayAuthenticatedV115Conversation } from '../../runtime/v115-authenticated-conversation-replay.mjs';

function validTarget(events = []) {
  return {
    appendChild() {},
    replaceChildren() {
      events.push('reset');
    },
  };
}

function validRenderers(events = []) {
  return {
    renderPersistedUserMessage(record) {
      events.push(`user:${record.content}`);
      return { role: 'user' };
    },
    renderPersistedAssistantMessage(record) {
      events.push(`assistant:${record.content}`);
      return { role: 'assistant' };
    },
  };
}

test('replay boundary rejects invalid inputs before mutating the rendered conversation', () => {
  const events = [];
  const chatInner = validTarget(events);

  assert.throws(
    () => replayAuthenticatedV115Conversation(null, { chatInner, renderers: validRenderers() }),
    /records must be an array/,
  );
  assert.throws(
    () => replayAuthenticatedV115Conversation([], { chatInner, renderers: {} }),
    /renderers\.renderPersistedUserMessage must be a function/,
  );
  assert.deepEqual(events, []);
});

test('replay boundary resets once before dispatching records in persisted order', () => {
  const events = [];
  const handles = replayAuthenticatedV115Conversation(
    [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'second' },
    ],
    { chatInner: validTarget(events), renderers: validRenderers(events) },
  );

  assert.deepEqual(events, ['reset', 'user:first', 'assistant:second']);
  assert.deepEqual(handles, [{ role: 'user' }, { role: 'assistant' }]);
});
