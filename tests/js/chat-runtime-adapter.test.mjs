import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildV115ChatCompletionRequest,
  normalizeV115ProxyBase,
  readV115ChatCompletionStream,
  requestV115ChatCompletion,
} from '../../runtime/v115-chat-runtime-adapter.mjs';

function sseResponse(chunks, { status = 200, ok = status >= 200 && status < 300 } = {}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return {
    ok,
    status,
    body: stream,
    text: async () => '',
  };
}

test('builds the authenticated-v115 OpenAI-compatible chat request contract', () => {
  const request = buildV115ChatCompletionRequest({
    proxyBase: 'http://127.0.0.1:8001/',
    masterKey: 'sk-test-local',
    model: 'AETHER-primary',
    messages: [
      { role: 'system', content: 'You are AETHER.' },
      { role: 'user', content: 'Build the page.' },
    ],
  });

  assert.equal(request.url, 'http://127.0.0.1:8001/v1/chat/completions');
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(request.options.headers, {
    'Content-Type': 'application/json',
    Authorization: 'Bearer sk-test-local',
  });
  assert.deepEqual(JSON.parse(request.options.body), {
    model: 'AETHER-primary',
    stream: true,
    messages: [
      { role: 'system', content: 'You are AETHER.' },
      { role: 'user', content: 'Build the page.' },
    ],
  });
  assert.deepEqual(request.contract, {
    protocol: 'openai-compatible-sse',
    model: 'AETHER-primary',
    stream: true,
    messageCount: 2,
  });
});

test('normalizes proxy URLs without preserving query, fragments, or trailing slashes', () => {
  assert.equal(
    normalizeV115ProxyBase('localhost:8001/base/?debug=1#frag'),
    'http://localhost:8001/base',
  );
  assert.throws(
    () => normalizeV115ProxyBase('https://user:pass@example.test'),
    /embedded credentials/,
  );
});

test('parses v115 SSE deltas across chunk boundaries until DONE', async () => {
  const deltas = [];
  const response = sseResponse([
    'data: {"choices":[{"delta":{"content":"Hel',
    'lo"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n',
    '\ndata: [DONE]\n\n',
  ]);

  const result = await readV115ChatCompletionStream(response, {
    onDelta: (delta) => deltas.push(delta),
  });

  assert.deepEqual(deltas, ['Hello', ' world']);
  assert.deepEqual(result, { content: 'Hello world', doneMarkerSeen: true });
});

test('ignores malformed SSE payloads while preserving later valid deltas', async () => {
  const response = sseResponse([
    'event: message\n',
    'data: not-json\n',
    'data: {"choices":[{"delta":{"content":"kept"}}]}\n',
  ]);

  assert.deepEqual(await readV115ChatCompletionStream(response), {
    content: 'kept',
    doneMarkerSeen: false,
  });
});

test('executes the maintained request boundary and returns endpoint-safe evidence', async () => {
  const calls = [];
  const result = await requestV115ChatCompletion(
    {
      proxyBase: 'http://127.0.0.1:8001',
      masterKey: 'secret-local-key',
      model: 'AETHER-advanced',
      messages: [{ role: 'user', content: 'Think deeper.' }],
    },
    {
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return sseResponse([
          'data: {"choices":[{"delta":{"content":"Done"}}]}\n',
          'data: [DONE]\n',
        ]);
      },
    },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://127.0.0.1:8001/v1/chat/completions');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer secret-local-key');
  assert.deepEqual(result, {
    content: 'Done',
    doneMarkerSeen: true,
    contract: {
      protocol: 'openai-compatible-sse',
      model: 'AETHER-advanced',
      stream: true,
      messageCount: 1,
    },
    endpoint: 'http://127.0.0.1:8001/v1/chat/completions',
  });
  assert.equal(JSON.stringify(result).includes('secret-local-key'), false);
});

test('propagates authenticated endpoint errors without attempting SSE parsing', async () => {
  const response = {
    ok: false,
    status: 503,
    body: null,
    text: async () => 'proxy unavailable',
  };

  await assert.rejects(
    () => readV115ChatCompletionStream(response),
    /proxy unavailable/,
  );
});

test('rejects invalid messages before any network request', async () => {
  let called = false;
  await assert.rejects(
    () =>
      requestV115ChatCompletion(
        { messages: [{ role: 'tool', content: 'bad' }] },
        {
          fetchImpl: async () => {
            called = true;
            return sseResponse([]);
          },
        },
      ),
    /role must be system, user, or assistant/,
  );
  assert.equal(called, false);
});
