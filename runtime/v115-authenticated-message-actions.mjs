const SUPPORTED_ACTIONS = new Set(['copy', 'share', 'like', 'dislike', 'regen']);

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

/**
 * Maintained behavioral adapter for the mechanically authenticated v115 `gn`
 * assistant-action boundary.
 *
 * v115 delegates clicks from `.msg-actions-row` buttons and preserves these
 * actions: copy, share (with clipboard fallback), mutually exclusive
 * like/dislike state, and regeneration from the preceding user prompt. The
 * broader More drawer stays historical until its individual paths are promoted
 * separately.
 */
export function createAuthenticatedV115MessageActions({
  clipboardWrite,
  share,
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

  async function perform({ action, text = '', button, row, wrap } = {}) {
    if (!SUPPORTED_ACTIONS.has(action)) return { handled: false };

    if (action === 'copy') {
      if (!clipboardWrite) throw new TypeError('clipboardWrite must be available for copy');
      await clipboardWrite(text);
      pulse(button, schedule);
      return { handled: true, action };
    }

    if (action === 'share') {
      if (share) await share({ text });
      else {
        if (!clipboardWrite) {
          throw new TypeError('clipboardWrite must be available when share is unavailable');
        }
        await clipboardWrite(text);
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

  async function handleClick(event) {
    const button = event?.target?.closest?.('.act-btn');
    if (!button) return { handled: false };

    const row = button.closest?.('.msg-actions-row');
    if (!row) return { handled: false };

    const candidate = row.previousElementSibling;
    const wrap = candidate?.classList?.contains?.('msg-wrap') ? candidate : null;
    const assistant = wrap?.querySelector?.('.msg.assistant');
    if (!assistant) return { handled: false };

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

  return { perform, handleClick };
}

export const AUTHENTICATED_V115_MESSAGE_ACTIONS = Object.freeze([
  'copy',
  'share',
  'like',
  'dislike',
  'regen',
]);
