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
  return `Double-check the previous response for accuracy. If anything is off, correct it and cite sources when possible.\n\nResponse to check:\n${text}`;
}

function reportPrompt(text) {
  return `Report: I think there may be an issue with the previous response.\n\nDescribe the issue briefly and suggest a fix.\n\nResponse:\n${text}`;
}

/**
 * Maintained behavioral adapter for the mechanically authenticated v115 `gn`
 * assistant-action boundary.
 *
 * Optional feedback is injected so UI hosts can show clear pending/success/error
 * states without coupling the maintained adapter to a particular notification UI.
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
  if (feedback !== undefined) {
    requireFunction(feedback.pending, 'feedback.pending');
    requireFunction(feedback.success, 'feedback.success');
    requireFunction(feedback.failure, 'feedback.failure');
  }
  if (clipboardWrite !== undefined) requireFunction(clipboardWrite, 'clipboardWrite');
  if (share !== undefined) requireFunction(share, 'share');
  if (exportText !== undefined) requireFunction(exportText, 'exportText');
  if (resetConversation !== undefined) requireFunction(resetConversation, 'resetConversation');
  if (createConversation !== undefined) requireFunction(createConversation, 'createConversation');
  if (getActiveConversation !== undefined) requireFunction(getActiveConversation, 'getActiveConversation');
  if (persistConversations !== undefined) requireFunction(persistConversations, 'persistConversations');
  if (renderConversationList !== undefined) requireFunction(renderConversationList, 'renderConversationList');
  if (renderActiveConversation !== undefined) requireFunction(renderActiveConversation, 'renderActiveConversation');

  const pending = (action) => feedback?.pending(action);
  const success = (action) => feedback?.success(action);
  const failure = (action) => feedback?.failure(action);

  async function perform({ action, text = '', button, row, wrap } = {}) {
    if (!SUPPORTED_ACTIONS.has(action)) return { handled: false };
    pending(action);

    try {
      if (action === 'copy') {
        if (!clipboardWrite) throw new TypeError('clipboardWrite must be available for copy');
        await clipboardWrite(text);
        pulse(button, schedule);
        success(action);
        return { handled: true, action };
      }

      if (action === 'share') {
        if (share) {
          await share({ text });
        } else {
          if (!clipboardWrite) throw new TypeError('clipboardWrite must be available when share is unavailable');
          await clipboardWrite(text);
          pulse(button, schedule);
        }
        success(action);
        return { handled: true, action };
      }

      if (action === 'like' || action === 'dislike') {
        const opposite = row?.querySelector?.(
          action === 'like' ? '[data-act="dislike"]' : '[data-act="like"]',
        );
        button?.classList?.toggle('is-on');
        opposite?.classList?.remove('is-on');
        success(action);
        return { handled: true, action };
      }

      const prompt = getPreviousUserText(wrap);
      if (!prompt) {
        success(action);
        return { handled: true, action, submitted: false };
      }
      setPrompt(prompt);
      await submit();
      success(action);
      return { handled: true, action, submitted: true, prompt };
    } catch (error) {
      failure(action);
      return { handled: true, action, error };
    }
  }

  async function performMore({ action, text = '', wrap } = {}) {
    if (!SUPPORTED_MORE_ACTIONS.has(action)) return { handled: false };
    pending(action);

    try {
      if (action === 'branch') {
        requireFunction(resetConversation, 'resetConversation');
        requireFunction(createConversation, 'createConversation');
        requireFunction(getActiveConversation, 'getActiveConversation');
        requireFunction(persistConversations, 'persistConversations');
        requireFunction(renderConversationList, 'renderConversationList');
        requireFunction(renderActiveConversation, 'renderActiveConversation');

        const userText = getPreviousUserText(wrap) || '';
        resetConversation();
        try {
          createConversation(userText, []);
        } catch {}

        const conversation = getActiveConversation();
        if (conversation) {
          if (userText) conversation.messages.push({ role: 'user', content: userText });
          if (text) conversation.messages.push({ role: 'assistant', content: text });
          persistConversations();
          renderConversationList();
          renderActiveConversation();
        }
        success(action);
        return { handled: true, action, branched: Boolean(conversation) };
      }

      if (action === 'export') {
        if (!exportText) throw new TypeError('exportText must be available for export');
        await exportText(text, {
          filename: 'AETHER_response.txt',
          type: 'text/plain;charset=utf-8',
        });
        success(action);
        return { handled: true, action };
      }

      const prompt = action === 'doublecheck' ? doublecheckPrompt(text) : reportPrompt(text);
      setPrompt(prompt);
      await submit();
      success(action);
      return { handled: true, action, submitted: true, prompt };
    } catch (error) {
      failure(action);
      return { handled: true, action, error };
    }
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
    return perform({ action, text: messageText(assistant), button, row, wrap });
  }

  return { perform, performMore, handleClick };
}

export const AUTHENTICATED_V115_MESSAGE_ACTIONS = Object.freeze(['copy', 'share', 'like', 'dislike', 'regen']);
export const AUTHENTICATED_V115_MORE_ACTIONS = Object.freeze(['branch', 'doublecheck', 'export', 'report']);
