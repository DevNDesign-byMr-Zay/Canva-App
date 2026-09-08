import { createV115UiAiBridge } from './v115-ui-ai-bridge.mjs';

export const V115_MAIN_CHAT_DOM = Object.freeze({
  composerInput: 'composerInput',
  sendButton: 'sendBtn',
  chatInner: 'chatInner',
});

function requireElement(documentRef, id) {
  const element = documentRef?.getElementById?.(id);
  if (!element) throw new Error(`authenticated-v115 DOM element #${id} is required`);
  return element;
}

function requireFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} must be a function`);
  return value;
}

/**
 * Binds the maintained UI/AI bridge to the mechanically authenticated v115
 * main-chat DOM edge without modifying the historical HTML artifact.
 *
 * Authenticated v115 evidence:
 *   #composerInput -> #sendBtn click / Enter-without-Shift -> main chat submit
 *   assistant output is attached under #chatInner
 *
 * Rendering remains injected so the maintained runtime does not silently
 * normalize historical message markup or overwrite later contributor work.
 */
export function bindAuthenticatedV115MainChat({
  document: documentRef = globalThis.document,
  renderUserMessage,
  beginAssistantMessage,
  appendAssistantDelta,
  finishAssistantMessage,
  renderError,
  requestImpl,
  runtime = {},
} = {}) {
  const composerInput = requireElement(documentRef, V115_MAIN_CHAT_DOM.composerInput);
  const sendButton = requireElement(documentRef, V115_MAIN_CHAT_DOM.sendButton);
  const chatInner = requireElement(documentRef, V115_MAIN_CHAT_DOM.chatInner);

  requireFunction(renderUserMessage, 'renderUserMessage');
  requireFunction(beginAssistantMessage, 'beginAssistantMessage');
  requireFunction(appendAssistantDelta, 'appendAssistantDelta');
  requireFunction(finishAssistantMessage, 'finishAssistantMessage');
  requireFunction(renderError, 'renderError');

  let activeController = null;

  const bridge = createV115UiAiBridge({
    readPrompt() {
      return composerInput.value;
    },
    renderUserMessage(prompt) {
      composerInput.value = '';
      renderUserMessage(prompt, { chatInner, composerInput, sendButton });
    },
    beginAssistantMessage() {
      return beginAssistantMessage({ chatInner, composerInput, sendButton });
    },
    appendAssistantDelta,
    finishAssistantMessage,
    renderError,
    ...(requestImpl ? { requestImpl } : {}),
    runtime,
  });

  async function submitOrAbort() {
    if (activeController) {
      activeController.abort();
      return { accepted: false, reason: 'aborted-active' };
    }

    const controller = new AbortController();
    activeController = controller;
    try {
      return await bridge.submit({ signal: controller.signal });
    } finally {
      if (activeController === controller) activeController = null;
    }
  }

  function onClick(event) {
    event?.preventDefault?.();
    void submitOrAbort();
  }

  function onKeyDown(event) {
    if (event?.key !== 'Enter' || event?.shiftKey) return;
    event.preventDefault?.();
    void submitOrAbort();
  }

  sendButton.addEventListener('click', onClick);
  composerInput.addEventListener('keydown', onKeyDown);

  return {
    bridge,
    elements: { composerInput, sendButton, chatInner },
    submitOrAbort,
    destroy() {
      activeController?.abort();
      activeController = null;
      sendButton.removeEventListener('click', onClick);
      composerInput.removeEventListener('keydown', onKeyDown);
    },
  };
}
