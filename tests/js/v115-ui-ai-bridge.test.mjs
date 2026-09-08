import test from 'node:test';
import assert from 'node:assert/strict';

import { createV115UiAiBridge } from '../../runtime/v115-ui-ai-bridge.mjs';

function harness(overrides = {}) {
  const events = [];
  const bridge = createV115UiAiBridge({
    readPrompt: async () => 'Build the layout',
    renderUserMessage: (prompt) => events.push(['user', prompt]),
    beginAssistantMessage: () => {
      events.push(['assistant-begin']);
      return 'assistant-1';
    },
    appendAssistantDelta: (handle, delta) => events.push(['delta', handle, delta]),
    finishAssistantMessage: (handle, result) => events.push(['assistant-finish', handle, result]),
    renderError: (error, context) => events.push(['error', error.message, context]),
    requestImpl: async (input, { onDelta }) => {
      onDelta('Hello ');
      onDelta('world');
      return {
        content: 'Hello world',
        doneMarkerSeen: true,
        endpoint: 'http://127.0.0.1:8001/v1/chat/completions',
        contract: { protocol: 'openai-compatible-sse', model: 'AETHER-primary', stream: true, messageCount: 1 },
      };
    },
    ...overrides,
  });
  return { bridge, events };
}

test('bridges an authenticated-v115 user prompt through streaming AI response rendering', async () => {
  let capturedInput;
  const { bridge, events } = harness({
    runtime: { proxyBase: 'http://127.0.0.1:8001', masterKey: 'test-key', model: 'AETHER-primary' },
    requestImpl: async (input, { onDelta }) => {
      capturedInput = input;
      onDelta('one');
      onDelta(' two');
      return { content: 'one two', doneMarkerSeen: true, endpoint: 'local', contract: { stream: true } };
    },
  });

  const outcome = await bridge.submit();

  assert.equal(outcome.accepted, true);
  assert.deepEqual(capturedInput.messages, [{ role: 'user', content: 'Build the layout' }]);
  assert.equal(capturedInput.model, 'AETHER-primary');
  assert.deepEqual(events.slice(0, 4), [
    ['user', 'Build the layout'],
    ['assistant-begin'],
    ['delta', 'assistant-1', 'one'],
    ['delta', 'assistant-1', ' two'],
  ]);
  assert.equal(events[4][0], 'assistant-finish');
  assert.equal(events[4][2].streamedContent, 'one two');
  assert.equal(bridge.inFlight, false);
});

test('rejects empty UI input without calling the network boundary', async () => {
  let calls = 0;
  const { bridge, events } = harness({
    readPrompt: () => '   ',
    requestImpl: async () => {
      calls += 1;
    },
  });

  const outcome = await bridge.submit();
  assert.equal(outcome.accepted, false);
  assert.equal(outcome.reason, 'invalid-prompt');
  assert.equal(calls, 0);
  assert.equal(events[0][0], 'error');
});

test('prevents duplicate submit while one request is in flight', async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const { bridge } = harness({
    requestImpl: async () => {
      await pending;
      return { content: '', doneMarkerSeen: true, endpoint: 'local', contract: {} };
    },
  });

  const first = bridge.submit();
  await Promise.resolve();
  assert.equal(bridge.inFlight, true);
  assert.deepEqual(await bridge.submit(), { accepted: false, reason: 'in-flight' });
  release();
  await first;
  assert.equal(bridge.inFlight, false);
});

test('preserves streamed partial content when runtime request fails', async () => {
  const { bridge, events } = harness({
    requestImpl: async (_input, { onDelta }) => {
      onDelta('partial');
      throw new Error('runtime unavailable');
    },
  });

  const outcome = await bridge.submit();
  assert.equal(outcome.accepted, true);
  assert.equal(outcome.error.message, 'runtime unavailable');
  const errorEvent = events.find(([kind]) => kind === 'error');
  assert.equal(errorEvent[2].streamedContent, 'partial');
});
