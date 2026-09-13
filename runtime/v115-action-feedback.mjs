const DEFAULT_MESSAGES = Object.freeze({
  copy: 'Copied',
  share: 'Ready to share',
  like: 'Feedback saved',
  dislike: 'Feedback saved',
  regen: 'Regenerated',
  branch: 'Branch created',
  doublecheck: 'Check complete',
  export: 'Export ready',
  report: 'Report started',
});

/**
 * Renderer-agnostic feedback adapter for authenticated v115 message actions.
 * Hosts can map these events to a toast, status region, or another maintained
 * UI surface without coupling action behavior to a particular renderer.
 */
export function createActionFeedback({ notify, clear = () => {} } = {}) {
  if (typeof notify !== 'function') throw new TypeError('notify must be a function.');
  if (typeof clear !== 'function') throw new TypeError('clear must be a function.');

  function emit(action, status, message) {
    try {
      const result = notify(Object.freeze({ action, status, message }));
      if (result && typeof result.then === 'function') result.catch(() => {});
    } catch {
      // Presentation feedback must never change the authenticated action result.
    }
  }

  function success(action, message = DEFAULT_MESSAGES[action] ?? 'Done') {
    emit(action, 'success', message);
  }

  function failure(action, message = 'Action could not be completed. Try again.') {
    emit(action, 'error', message);
  }

  function pending(action, message = 'Working…') {
    emit(action, 'pending', message);
  }

  return Object.freeze({ success, failure, pending, clear });
}

export const AUTHENTICATED_V115_ACTION_FEEDBACK = DEFAULT_MESSAGES;
