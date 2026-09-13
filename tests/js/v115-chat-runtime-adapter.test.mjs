import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildV115ChatCompletionRequest,
  readV115ChatCompletionStream,
  requestV115ChatCompletion,
} from '../../runtime/v115-chat-runtime-adapter.mjs';

function streamResponse(chunks, { ok = true, status = 200 } = {}) {
  let index = 0;
  let released = false;
  return {
    ok,
    status,
    body: {
      getReader() {
        return {
          async read() {
            if (index >= chunks.length) return { done: true, value: undefined };
            return { done: false, value: new TextEncoder().encode(chunks[index++]) };
          },
          releaseLock() {
            released = true;
          },
        };
      },
    },
    get released() {
      return released;
    },
  };
}

test('builds a validated OpenAI-compatible request', () => {
  const request = buildV115ChatCompletionRequest({
    proxyBase: 'http://127.0.0.1:8001///?ignored=yes',
    masterKey: 'test-key',
    model: 'test-model',
    messages: [{ role: 'user', content: 'hello' }],
  });

  assert.equal(request.url, 'http://127.0.0.1:8001/v1/chat/completions');
  assert.equal(request.options.headers.Authorization, 'Bearer test-key');
  assert.deepEqual(JSON.parse(request.options.body), {
    model: 'test-model',
    stream: true,
    messages: [{ role: 'user', content: 'hello' }],
  });
});

test('reassembles split SSE chunks and releases the reader', async () => {
  const response = streamResponse([
    'data: {"choices":[{"delta":{"content":"hel',
    'lo"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\ndata: [DONE]\n\n',
  ]);
  const deltas = [];
  const result = await readV115ChatCompletionStream(response, { onDelta: (delta) => deltas.push(delta) });

  assert.deepEqual(result, { content: 'hello world', doneMarkerSeen: true });
  assert.deepEqual(deltas, ['hello', ' world']);
  assert.equal(response.released, true);
});

test('returns a usable partial result when the stream closes without DONE', async () => {
  const response = streamResponse(['data: {"choices":[{"delta":{"content":"partial"}}]}\n']);
  const result = await readV115ChatCompletionStream(response);

  assert.deepEqual(result, { content: 'partial', doneMarkerSeen: false });
  assert.equal(response.released, true);
});

test('surfaces non-successful API responses', async () => {
  const response = { ok: false, status: 503, text: async () => 'service unavailable' };
  await assert.rejects(() => readV115ChatCompletionStream(response), /service unavailable/);
});

test('keeps the request contract attached to streamed results', async () => {
  const response = streamResponse(['data: {"choices":[{"delta":{"content":"ok"}}]}\n', 'data: [DONE]\n']);
  const result = await requestV115ChatCompletion(
    { proxyBase: 'http://localhost:8001', masterKey: 'key', model: 'model', messages: [{ role: 'user', content: 'x' }] },
    { fetchImpl: async () => response },
  );

  assert.equal(result.content, 'ok');
  assert.equal(result.doneMarkerSeen, true);
  assert.equal(result.contract.protocol, 'openai-compatible-sse');
  assert.equal(result.endpoint, 'http://localhost:8001/v1/chat/completions');
});
