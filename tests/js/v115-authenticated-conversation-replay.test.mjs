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
  assert.throws(
    () => replayAuthenticatedV115Conversation(
      [{ role: 'system', content: 'unsupported' }],
      { chatInner, renderers: validRenderers() },
    ),
    /records\[0\]\.role must be user or assistant/,
  );
  assert.deepEqual(events, []);
});

test('replay validates the complete record list before clearing existing conversation DOM', () => {
  const events = [];
  const chatInner = validTarget(events);

  assert.throws(
    () => replayAuthenticatedV115Conversation(
      [
        { role: 'user', content: 'safe first record' },
        { role: 'system', content: 'invalid later record' },
      ],
      { chatInner, renderers: validRenderers(events) },
    ),
    /records\[1\]\.role must be user or assistant/,
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

test('replay boundary falls back to clearing innerHTML when replaceChildren is unavailable', () => {
  const events = [];
  const chatInner = {
    appendChild() {},
    innerHTML: '<div>stale replay</div>',
  };

  replayAuthenticatedV115Conversation(
    [{ role: 'assistant', content: 'fresh' }],
    { chatInner, renderers: validRenderers(events) },
  );

  assert.equal(chatInner.innerHTML, '');
  assert.deepEqual(events, ['assistant:fresh']);
});

test('replay rejects non-object records and unsupported chat reset capabilities', () => {
  assert.throws(
    () => replayAuthenticatedV115Conversation([], { chatInner: validTarget(), renderers: [] }),
    /renderers must be an object/,
  );
  assert.throws(
    () => replayAuthenticatedV115Conversation([null], { chatInner: validTarget(), renderers: validRenderers() }),
    /records\[0\] must be an object/,
  );
  assert.throws(
    () => replayAuthenticatedV115Conversation(
      [{ role: 'user', content: 'safe' }],
      { chatInner: { appendChild() {} }, renderers: validRenderers() },
    ),
    /chatInner must support replaceChildren\(\) or innerHTML reset/,
  );
  assert.throws(
    () => replayAuthenticatedV115Conversation([], { chatInner: null, renderers: validRenderers() }),
    /chatInner must support appendChild/,
  );
});
