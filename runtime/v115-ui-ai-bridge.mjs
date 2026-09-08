import { requestV115ChatCompletion } from './v115-chat-runtime-adapter.mjs';

function requireFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} must be a function`);
  return value;
}

function requirePrompt(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('prompt must be a non-empty string');
  }
  return value.trim();
}

/**
 * Maintained UI-to-AI bridge for authenticated-v115.
 *
 * The historical HTML remains untouched. UI extraction/rendering is injected
 * so only mechanically authenticated DOM evidence is bound by callers; this
 * module owns the end-to-end lifecycle from user prompt -> v115 request ->
 * streamed UI updates.
 */
export function createV115UiAiBridge({
  readPrompt,
  renderUserMessage,
  beginAssistantMessage,
  appendAssistantDelta,
  finishAssistantMessage,
  renderError,
  requestImpl = requestV115ChatCompletion,
  runtime = {},
} = {}) {
  requireFunction(readPrompt, 'readPrompt');
  requireFunction(renderUserMessage, 'renderUserMessage');
  requireFunction(beginAssistantMessage, 'beginAssistantMessage');
  requireFunction(appendAssistantDelta, 'appendAssistantDelta');
  requireFunction(finishAssistantMessage, 'finishAssistantMessage');
  requireFunction(renderError, 'renderError');
  requireFunction(requestImpl, 'requestImpl');

  let inFlight = false;

  async function submit({ signal } = {}) {
    if (inFlight) return { accepted: false, reason: 'in-flight' };

    let prompt;
    try {
      prompt = requirePrompt(await readPrompt());
    } catch (error) {
      renderError(error);
      return { accepted: false, reason: 'invalid-prompt', error };
    }

    inFlight = true;
    renderUserMessage(prompt);
    const assistantHandle = beginAssistantMessage();
    let streamedContent = '';

    try {
      const result = await requestImpl(
        {
          ...runtime,
          messages: [{ role: 'user', content: prompt }],
          ...(signal ? { signal } : {}),
        },
        {
          onDelta(delta) {
            streamedContent += delta;
            appendAssistantDelta(assistantHandle, delta);
          },
        },
      );

      finishAssistantMessage(assistantHandle, {
        content: result.content,
        streamedContent,
        doneMarkerSeen: result.doneMarkerSeen,
        contract: result.contract,
        endpoint: result.endpoint,
      });
      return { accepted: true, result };
    } catch (error) {
      renderError(error, { assistantHandle, streamedContent });
      return { accepted: true, error };
    } finally {
      inFlight = false;
    }
  }

  return {
    submit,
    get inFlight() {
      return inFlight;
    },
  };
}
