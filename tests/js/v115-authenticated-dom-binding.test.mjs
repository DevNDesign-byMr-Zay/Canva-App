import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bindAuthenticatedV115MainChat,
  V115_MAIN_CHAT_DOM,
} from '../../runtime/v115-authenticated-dom-binding.mjs';

function eventTarget(extra = {}) {
  const listeners = new Map();
  return {
    ...extra,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    dispatch(type, event = {}) {
      return listeners.get(type)?.(event);
    },
    hasListener(type) {
      return listeners.has(type);
    },
  };
}

function authenticatedDocument(prompt = 'Build ROARY') {
  const elements = {
    [V115_MAIN_CHAT_DOM.composerInput]: eventTarget({ value: prompt }),
    [V115_MAIN_CHAT_DOM.sendButton]: eventTarget(),
    [V115_MAIN_CHAT_DOM.chatInner]: eventTarget(),
  };
  return {
    elements,
    getElementById(id) {
      return elements[id] ?? null;
    },
  };
}

function renderers(events) {
  return {
    renderUserMessage(prompt, context) {
      events.push(['user', prompt, context.chatInner]);
    },
    beginAssistantMessage(context) {
      events.push(['begin', context.chatInner]);
      return { id: 'assistant-1' };
    },
    appendAssistantDelta(handle, delta) {
      events.push(['delta', handle.id, delta]);
    },
    finishAssistantMessage(handle, result) {
      events.push(['finish', handle.id, result.content]);
    },
    renderError(error) {
      events.push(['error', error.message]);
    },
  };
}

test('authenticated main-chat binding submits #composerInput through the v115 bridge', async () => {
  const documentRef = authenticatedDocument('  Ship the runtime  ');
  const events = [];
  const requests = [];

  const binding = bindAuthenticatedV115MainChat({
    document: documentRef,
    ...renderers(events),
    requestImpl: async (input, { onDelta }) => {
      requests.push(input);
      onDelta('ready');
      return {
        content: 'ready',
        doneMarkerSeen: true,
        contract: 'openai-chat-completions-sse',
        endpoint: 'http://127.0.0.1:8001/v1/chat/completions',
      };
    },
  });

  const result = await binding.submitOrAbort();

  assert.equal(result.accepted, true);
  assert.equal(documentRef.elements.composerInput.value, '');
  assert.deepEqual(requests[0].messages, [{ role: 'user', content: 'Ship the runtime' }]);
  assert.deepEqual(
    events.map((event) => event[0]),
    ['user', 'begin', 'delta', 'finish'],
  );
  assert.equal(events[0][2], documentRef.elements.chatInner);
  binding.destroy();
});

test('authenticated click and Enter boundaries are bound and removable', async () => {
  const documentRef = authenticatedDocument('hello');
  const events = [];
  let calls = 0;

  const binding = bindAuthenticatedV115MainChat({
    document: documentRef,
    ...renderers(events),
    requestImpl: async (_input, { onDelta }) => {
      calls += 1;
      onDelta('ok');
      return { content: 'ok', doneMarkerSeen: true };
    },
  });

  let prevented = false;
  documentRef.elements.sendBtn.dispatch('click', {
    preventDefault() {
      prevented = true;
    },
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(prevented, true);
  assert.equal(calls, 1);

  documentRef.elements.composerInput.value = 'again';
  documentRef.elements.composerInput.dispatch('keydown', {
    key: 'Enter',
    shiftKey: false,
    preventDefault() {},
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 2);

  binding.destroy();
  assert.equal(documentRef.elements.sendBtn.hasListener('click'), false);
  assert.equal(documentRef.elements.composerInput.hasListener('keydown'), false);
});

test('missing authenticated DOM evidence fails closed', () => {
  const documentRef = authenticatedDocument();
  delete documentRef.elements.chatInner;

  assert.throws(
    () =>
      bindAuthenticatedV115MainChat({
        document: documentRef,
        ...renderers([]),
      }),
    /#chatInner is required/,
  );
});
