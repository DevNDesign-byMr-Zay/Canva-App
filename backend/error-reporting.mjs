function boundedText(value, name) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > 128) {
    throw new TypeError(`${name} must be a non-empty string up to 128 characters`);
  }
  return text;
}

function reporterFailureMetadata(error) {
  return {
    event: 'error_reporter_failed',
    errorName: error instanceof Error ? error.name : 'Error',
  };
}

export function createErrorReporter({ onError = null, logger = console } = {}) {
  if (onError !== null && typeof onError !== 'function') {
    throw new TypeError('onError must be a function when provided');
  }

  return function reportError(error, context = {}) {
    if (!onError) return;

    const safeContext = Object.freeze({
      scope: boundedText(context.scope ?? 'review-context', 'scope'),
      ...(context.designId
        ? { designId: boundedText(context.designId, 'designId') }
        : {}),
    });

    try {
      const result = onError(error, safeContext);
      if (result && typeof result.then === 'function') {
        void Promise.resolve(result).catch((reporterError) => {
          logger.warn?.(reporterFailureMetadata(reporterError), 'Error reporter failed');
        });
      }
    } catch (reporterError) {
      logger.warn?.(reporterFailureMetadata(reporterError), 'Error reporter failed');
    }
  };
}
