const SUPPORTED_ACTIONS = new Set(['copy', 'share', 'like', 'dislike', 'regen']);
const SUPPORTED_MORE_ACTIONS = new Set(['branch', 'doublecheck', 'export', 'report']);

function requireFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} must be a function`);
  return value;
}

function messageText(message) {
  return (message?.innerText || message?.textContent || '').trim();
}

function pulse(button, schedule) {
  if (!button?.classList) return;
  button.classList.add('is-on');
  schedule(() => button.classList.remove('is-on'), 900);
}

function doublecheckPrompt(text) {
  return `Double-check the previous response for accuracy. If anything is off, correct it and cite sources when possible.

Response to check:
${text}`;
}

function reportPrompt(text) {
  return `Report: I think there may be an issue with the previous response.

Describe the issue briefly and suggest a fix.

Response:
${text}`;
}

function createFeedbackEmitter(feedback) {
  if (feedback === undefined) return () => {};
  if (!feedback || typeof feedback !== 'object' || Array.isArray(feedback)) {
    throw new TypeError('feedback must be an object');
  }
  requireFunction(feedback.pending, 'feedback.pending');
  requireFunction(feedback.success, 'feedback.success');
  requireFunction(feedback.failure, 'feedback.failure');

  return (state, action) => {
    try {
      const result = feedback[state](action);
      if (result && typeof result.then === 'function') result.catch(() => {});
    } catch {
      // Presentation feedback must never change the authenticated action result.
    }
  };
}

/**
 * Maintained behavioral adapter for the mechanically authenticated v115 `gn`
 * assistant-action boundary.
 *
 * v115 delegates clicks from `.msg-actions-row` buttons and preserves these
 * actions: copy, share (with clipboard fallback), mutually exclusive
 * like/dislike state, regeneration from the preceding user prompt, and the
 * separately promoted More-drawer branch/double-check/export/report paths.
 *
 * Optional feedback is observational only. It can expose pending/success/error
 * states to a host UI without changing the preserved action return or failure
 * behavior, and feedback-renderer failures are contained at this boundary.
 */
export function createAuthenticatedV115MessageActions({
  clipboardWrite,
  share,
  exportText,
  schedule = globalThis.setTimeout,
  getPreviousUserText,
  setPrompt,
  submit,
  resetConversation,
  createConversation,
  getActiveConversation,
  persistConversations,
  renderConversationList,
  renderActiveConversation,
  feedback,
} = {}) {
  requireFunction(schedule, 'schedule');
  requireFunction(getPreviousUserText, 'getPreviousUserText');
  requireFunction(setPrompt, 'setPrompt');
  requireFunction(submit, 'submit');
  if (clipboardWrite !== undefined) requireFunction(clipboardWrite, 'clipboardWrite');
  if (share !== undefined) requireFunction(share, 'share');
  if (exportText !== undefined) requireFunction(exportText, 'exportText');
  if (resetConversation !== undefined) requireFunction(resetConversation, 'resetConversation');
  if (createConversation !== undefined) requireFunction(createConversation, 'createConversation');
  if (getActiveConversation !== undefined) requireFunction(getActiveConversation, 'getActiveConversation');
  if (persistConversations !== undefined) requireFunction(persistConversations, 'persistConversations');
  if (renderConversationList !== undefined) requireFunction(renderConversationList, 'renderConversationList');
  if (renderActiveConversation !== undefined) requireFunction(renderActiveConversation, 'renderActiveConversation');

  const emitFeedback = createFeedbackEmitter(feedback);

  async function perform({ action, text = '', button, row, wrap } = {}) {
    if (!SUPPORTED_ACTIONS.has(action)) return { handled: false };

    if (action === 'copy') {
      if (!clipboardWrite) {
        emitFeedback('failure', action);
        throw new TypeError('clipboardWrite must be available for copy');
      }
      emitFeedback('pending', action);
      try {
        await clipboardWrite(text);
      } catch {
        emitFeedback('failure', action);
        return { handled: true, action };
      }
      pulse(button, schedule);
      emitFeedback('success', action);
      return { handled: true, action };
    }

    if (action === 'share') {
      emitFeedback('pending', action);
      if (share) {
        try {
          await share({ text });
        } catch {
          emitFeedback('failure', action);
          return { handled: true, action };
        }
      } else {
        if (!clipboardWrite) {
          emitFeedback('failure', action);
          throw new TypeError('clipboardWrite must be available when share is unavailable');
        }
        try {
          await clipboardWrite(text);
        } catch {
          emitFeedback('failure', action);
          return { handled: true, action };
        }
        pulse(button, schedule);
      }
      emitFeedback('success', action);
      return { handled: true, action };
    }

    if (action === 'like' || action === 'dislike') {
      const opposite = row?.querySelector?.(
        action === 'like' ? '[data-act="dislike"]' : '[data-act="like"]',
      );
      button?.classList?.toggle('is-on');
      opposite?.classList?.remove('is-on');
      emitFeedback('success', action);
      return { handled: true, action };
    }

    const prompt = getPreviousUserText(wrap);
    if (!prompt) return { handled: true, action, submitted: false };
    emitFeedback('pending', action);
    try {
      setPrompt(prompt);
      await submit();
    } catch (error) {
      emitFeedback('failure', action);
      throw error;
    }
    emitFeedback('success', action);
    return { handled: true, action, submitted: true, prompt };
  }

  async function performMore({ action, text = '', wrap } = {}) {
    if (!SUPPORTED_MORE_ACTIONS.has(action)) return { handled: false };

    if (action === 'branch') {
      requireFunction(resetConversation, 'resetConversation');
      requireFunction(createConversation, 'createConversation');
      requireFunction(getActiveConversation, 'getActiveConversation');
      requireFunction(persistConversations, 'persistConversations');
      requireFunction(renderConversationList, 'renderConversationList');
      requireFunction(renderActiveConversation, 'renderActiveConversation');

      emitFeedback('pending', action);
      const userText = getPreviousUserText(wrap) || '';
      resetConversation();
      try {
        createConversation(userText, []);
      } catch {}

      try {
        const conversation = getActiveConversation();
        if (!conversation) {
          emitFeedback('failure', action);
          return { handled: true, action, branched: false };
        }
        if (userText) conversation.messages.push({ role: 'user', content: userText });
        if (text) conversation.messages.push({ role: 'assistant', content: text });
        persistConversations();
        renderConversationList();
        renderActiveConversation();
        emitFeedback('success', action);
        return { handled: true, action, branched: true };
      } catch (error) {
        emitFeedback('failure', action);
        throw error;
      }
    }

    if (action === 'export') {
      if (!exportText) {
        emitFeedback('failure', action);
        throw new TypeError('exportText must be available for export');
      }
      emitFeedback('pending', action);
      try {
        await exportText(text, {
          filename: 'AETHER_response.txt',
          type: 'text/plain;charset=utf-8',
        });
      } catch {
        emitFeedback('failure', action);
        return { handled: true, action };
      }
      emitFeedback('success', action);
      return { handled: true, action };
    }

    const prompt = action === 'doublecheck' ? doublecheckPrompt(text) : reportPrompt(text);
    emitFeedback('pending', action);
    try {
      setPrompt(prompt);
      await submit();
    } catch (error) {
      emitFeedback('failure', action);
      throw error;
    }
    emitFeedback('success', action);
    return { handled: true, action, submitted: true, prompt };
  }

  async function handleClick(event) {
    const item = event?.target?.closest?.('.act-item');
    const button = item ? null : event?.target?.closest?.('.act-btn');
    const trigger = item || button;
    if (!trigger) return { handled: false };

    const row = trigger.closest?.('.msg-actions-row');
    if (!row) return { handled: false };

    const candidate = row.previousElementSibling;
    const wrap = candidate?.classList?.contains?.('msg-wrap') ? candidate : null;
    const assistant = wrap?.querySelector?.('.msg.assistant');
    if (!assistant) return { handled: false };

    if (item) {
      const action = item.dataset?.item;
      if (!SUPPORTED_MORE_ACTIONS.has(action)) return { handled: false };
      event.stopPropagation?.();
      return performMore({ action, text: messageText(assistant), wrap });
    }

    const action = button.dataset?.act;
    if (!SUPPORTED_ACTIONS.has(action)) return { handled: false };

    event.stopPropagation?.();
    return perform({
      action,
      text: messageText(assistant),
      button,
      row,
      wrap,
    });
  }

  return { perform, performMore, handleClick };
}

export const AUTHENTICATED_V115_MESSAGE_ACTIONS = Object.freeze([
  'copy',
  'share',
  'like',
  'dislike',
  'regen',
]);

export const AUTHENTICATED_V115_MORE_ACTIONS = Object.freeze([
  'branch',
  'doublecheck',
  'export',
  'report',
]);
