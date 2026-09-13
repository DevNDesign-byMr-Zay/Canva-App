const DEFAULT_MESSAGES = Object.freeze({
  copy: 'Copied',
  share: 'Ready to share',
  like: 'Feedback saved',
  dislike: 'Feedback saved',
  regen: 'Regenerating',
  branch: 'Branch created',
  doublecheck: 'Checking response',
  export: 'Export ready',
  report: 'Report started',
});

/**
 * Small UI feedback adapter for authenticated v115 message actions.
 * Rendering is injected so the maintained runtime remains DOM-agnostic.
 */
export function createActionFeedback({ notify, clear = () => {} } = {}) {
  if (typeof notify !== 'function') throw new TypeError('notify must be a function.');
  if (typeof clear !== 'function') throw new TypeError('clear must be a function.');

  function success(action, message = DEFAULT_MESSAGES[action]) {
    notify({ action, status: 'success', message: message ?? 'Done' });
  }

  function failure(action, message = 'Action could not be completed. Try again.') {
    notify({ action, status: 'error', message });
  }

  function pending(action, message = 'Working…') {
    notify({ action, status: 'pending', message });
  }

  return Object.freeze({ success, failure, pending, clear });
}

export const AUTHENTICATED_V115_ACTION_FEEDBACK = DEFAULT_MESSAGES;
