import { createV115UiAiBridge } from './v115-ui-ai-bridge.mjs';

export const V115_MAIN_CHAT_DOM = Object.freeze({
  composerInput: 'composerInput',
  sendButton: 'sendBtn',
  chatInner: 'chatInner',
});

const bindings = new WeakMap();

function requireElement(documentRef, id) {
  const element = documentRef?.getElementById?.(id);
  if (!element) throw new Error(`authenticated-v115 DOM element #${id} is required`);
  return element;
}

function requireFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} must be a function`);
  return value;
}

function createBridge({
  composerInput,
  sendButton,
  chatInner,
  renderUserMessage,
  beginAssistantMessage,
  appendAssistantDelta,
  finishAssistantMessage,
  renderError,
  requestImpl,
  runtime,
}) {
  return createV115UiAiBridge({
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
}

/**
 * Binds the maintained UI/AI bridge to the mechanically authenticated v115
 * main-chat DOM edge without modifying the historical HTML artifact.
 *
 * Authenticated v115 evidence:
 *   #composerInput -> #sendBtn click / Enter-without-Shift -> main chat submit
 *   assistant output is attached under #chatInner
 *
 * Rebinding the same authenticated DOM reuses the existing listener pair and
 * updates its bridge dependencies. This prevents duplicate submit work during
 * remounts while keeping rendering injected and historical markup untouched.
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

  const nextBridge = createBridge({
    composerInput,
    sendButton,
    chatInner,
    renderUserMessage,
    beginAssistantMessage,
    appendAssistantDelta,
    finishAssistantMessage,
    renderError,
    requestImpl,
    runtime,
  });

  const existing = bindings.get(composerInput);
  if (existing && existing.sendButton === sendButton && existing.chatInner === chatInner) {
    existing.bridge = nextBridge;
    return existing.binding;
  }
  existing?.binding.destroy();

  const state = {
    activeController: null,
    bridge: nextBridge,
    sendButton,
    chatInner,
    binding: null,
  };

  async function submitOrAbort() {
    if (state.activeController) {
      state.activeController.abort();
      return { accepted: false, reason: 'aborted-active' };
    }

    const controller = new AbortController();
    state.activeController = controller;
    try {
      return await state.bridge.submit({ signal: controller.signal });
    } finally {
      if (state.activeController === controller) state.activeController = null;
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

  state.binding = {
    get bridge() {
      return state.bridge;
    },
    elements: { composerInput, sendButton, chatInner },
    submitOrAbort,
    destroy() {
      state.activeController?.abort();
      state.activeController = null;
      sendButton.removeEventListener('click', onClick);
      composerInput.removeEventListener('keydown', onKeyDown);
      if (bindings.get(composerInput) === state) bindings.delete(composerInput);
    },
  };

  bindings.set(composerInput, state);
  return state.binding;
}
