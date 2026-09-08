const SUPPORTED_ACTIONS = new Set(['copy', 'share', 'like', 'dislike', 'regen']);
const SUPPORTED_MORE_ACTIONS = new Set(['doublecheck', 'export', 'report']);

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

/**
 * Maintained behavioral adapter for the mechanically authenticated v115 `gn`
 * assistant-action boundary.
 *
 * v115 delegates clicks from `.msg-actions-row` buttons and preserves these
 * actions: copy, share (with clipboard fallback), mutually exclusive
 * like/dislike state, regeneration from the preceding user prompt, and the
 * separately promoted More-drawer double-check/export/report paths. Other More
 * actions remain historical until their individual paths are promoted separately.
 */
export function createAuthenticatedV115MessageActions({
  clipboardWrite,
  share,
  exportText,
  schedule = globalThis.setTimeout,
  getPreviousUserText,
  setPrompt,
  submit,
} = {}) {
  requireFunction(schedule, 'schedule');
  requireFunction(getPreviousUserText, 'getPreviousUserText');
  requireFunction(setPrompt, 'setPrompt');
  requireFunction(submit, 'submit');
  if (clipboardWrite !== undefined) requireFunction(clipboardWrite, 'clipboardWrite');
  if (share !== undefined) requireFunction(share, 'share');
  if (exportText !== undefined) requireFunction(exportText, 'exportText');

  async function perform({ action, text = '', button, row, wrap } = {}) {
    if (!SUPPORTED_ACTIONS.has(action)) return { handled: false };

    if (action === 'copy') {
      if (!clipboardWrite) throw new TypeError('clipboardWrite must be available for copy');
      try {
        await clipboardWrite(text);
      } catch {
        return { handled: true, action };
      }
      pulse(button, schedule);
      return { handled: true, action };
    }

    if (action === 'share') {
      if (share) {
        try {
          await share({ text });
        } catch {
          return { handled: true, action };
        }
      } else {
        if (!clipboardWrite) {
          throw new TypeError('clipboardWrite must be available when share is unavailable');
        }
        try {
          await clipboardWrite(text);
        } catch {
          return { handled: true, action };
        }
        pulse(button, schedule);
      }
      return { handled: true, action };
    }

    if (action === 'like' || action === 'dislike') {
      const opposite = row?.querySelector?.(
        action === 'like' ? '[data-act="dislike"]' : '[data-act="like"]',
      );
      button?.classList?.toggle('is-on');
      opposite?.classList?.remove('is-on');
      return { handled: true, action };
    }

    const prompt = getPreviousUserText(wrap);
    if (!prompt) return { handled: true, action, submitted: false };
    setPrompt(prompt);
    await submit();
    return { handled: true, action, submitted: true, prompt };
  }

  async function performMore({ action, text = '' } = {}) {
    if (!SUPPORTED_MORE_ACTIONS.has(action)) return { handled: false };

    if (action === 'export') {
      if (!exportText) throw new TypeError('exportText must be available for export');
      try {
        await exportText(text, {
          filename: 'AETHER_response.txt',
          type: 'text/plain;charset=utf-8',
        });
      } catch {
        return { handled: true, action };
      }
      return { handled: true, action };
    }

    const prompt = action === 'doublecheck' ? doublecheckPrompt(text) : reportPrompt(text);
    setPrompt(prompt);
    await submit();
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
      return performMore({ action, text: messageText(assistant) });
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
  'doublecheck',
  'export',
  'report',
]);
