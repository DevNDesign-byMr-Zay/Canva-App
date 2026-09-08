const DEFAULT_PROXY_BASE = 'http://127.0.0.1:8001';
const DEFAULT_MASTER_KEY = 'sk-AETHER-local';
const DEFAULT_MODEL = 'AETHER-primary';

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new TypeError('messages must be a non-empty array');
  }
  return messages.map((message, index) => {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      throw new TypeError(`messages[${index}] must be an object`);
    }
    const role = requireNonEmptyString(message.role, `messages[${index}].role`);
    if (!['system', 'user', 'assistant'].includes(role)) {
      throw new TypeError(`messages[${index}].role must be system, user, or assistant`);
    }
    if (typeof message.content !== 'string' && !Array.isArray(message.content)) {
      throw new TypeError(`messages[${index}].content must be a string or content array`);
    }
    return { role, content: message.content };
  });
}

export function normalizeV115ProxyBase(value = DEFAULT_PROXY_BASE) {
  const raw = requireNonEmptyString(value, 'proxyBase');
  const candidate = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new TypeError('proxyBase must be a valid HTTP(S) URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new TypeError('proxyBase must use HTTP or HTTPS');
  }
  if (parsed.username || parsed.password) {
    throw new TypeError('proxyBase must not include embedded credentials');
  }
  parsed.search = '';
  parsed.hash = '';
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  return parsed.toString().replace(/\/$/, '');
}

/**
 * Maintained representation of the authenticated-v115 chat boundary. The
 * legacy artifact posts an OpenAI-compatible streaming request to
 * `${proxy}/v1/chat/completions` with a bearer master key and model/messages.
 */
export function buildV115ChatCompletionRequest({
  proxyBase = DEFAULT_PROXY_BASE,
  masterKey = DEFAULT_MASTER_KEY,
  model = DEFAULT_MODEL,
  messages,
  stream = true,
  signal,
} = {}) {
  if (typeof stream !== 'boolean') throw new TypeError('stream must be a boolean');
  const base = normalizeV115ProxyBase(proxyBase);
  const token = requireNonEmptyString(masterKey, 'masterKey');
  const normalizedModel = requireNonEmptyString(model, 'model');
  const normalizedMessages = normalizeMessages(messages);

  return {
    url: `${base}/v1/chat/completions`,
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: normalizedModel,
        stream,
        messages: normalizedMessages,
      }),
      ...(signal ? { signal } : {}),
    },
    contract: {
      protocol: 'openai-compatible-sse',
      model: normalizedModel,
      stream,
      messageCount: normalizedMessages.length,
    },
  };
}

async function requireSuccessfulResponse(response) {
  if (response?.ok) return response;
  let detail = '';
  try {
    detail = typeof response?.text === 'function' ? await response.text() : '';
  } catch {
    detail = '';
  }
  const status = Number(response?.status ?? 0);
  throw new Error(detail || `API Error: ${status}`);
}

function consumeSseLine(line, onDelta) {
  if (!line.startsWith('data: ')) return { done: false, delta: '' };
  const payload = line.slice(6).trim();
  if (payload === '[DONE]') return { done: true, delta: '' };
  try {
    const parsed = JSON.parse(payload);
    const delta = parsed?.choices?.[0]?.delta?.content ?? '';
    if (typeof delta === 'string' && delta) {
      onDelta(delta);
      return { done: false, delta };
    }
  } catch {
    // Authenticated v115 ignores malformed/non-delta SSE lines and keeps streaming.
  }
  return { done: false, delta: '' };
}

export async function readV115ChatCompletionStream(response, { onDelta = () => {} } = {}) {
  if (typeof onDelta !== 'function') throw new TypeError('onDelta must be a function');
  const successful = await requireSuccessfulResponse(response);
  if (!successful.body || typeof successful.body.getReader !== 'function') {
    throw new TypeError('streaming response body must expose getReader()');
  }

  const reader = successful.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let doneMarkerSeen = false;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const consumed = consumeSseLine(line, onDelta);
      content += consumed.delta;
      if (consumed.done) {
        doneMarkerSeen = true;
        return { content, doneMarkerSeen };
      }
    }
  }

  buffer += decoder.decode();
  if (buffer) {
    const consumed = consumeSseLine(buffer, onDelta);
    content += consumed.delta;
    doneMarkerSeen = consumed.done;
  }
  return { content, doneMarkerSeen };
}

export async function requestV115ChatCompletion(
  input,
  { fetchImpl = globalThis.fetch, onDelta = () => {} } = {},
) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const request = buildV115ChatCompletionRequest(input);
  const response = await fetchImpl(request.url, request.options);
  const stream = await readV115ChatCompletionStream(response, { onDelta });
  return {
    ...stream,
    contract: request.contract,
    endpoint: request.url,
  };
}
