function requireLoggerName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > 64) throw new TypeError('logger name must be 1-64 characters');
  return name;
}

function safeMetadata(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('log metadata must be an object');
  }
  return Object.freeze({ ...value });
}

export function createJsonLogger({
  name = 'canva-review-context',
  sink = console,
  now = () => new Date().toISOString(),
} = {}) {
  const loggerName = requireLoggerName(name);
  if (!sink || typeof sink !== 'object') throw new TypeError('log sink must be an object');
  if (typeof now !== 'function') throw new TypeError('now must be a function');

  function emit(level, metadata, message) {
    const payload = {
      timestamp: now(),
      level,
      logger: loggerName,
      message: typeof message === 'string' ? message : '',
      ...safeMetadata(metadata),
    };
    const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info';
    sink[method]?.(JSON.stringify(payload));
  }

  return Object.freeze({
    info(metadata, message = '') {
      emit('info', metadata, message);
    },
    warn(metadata, message = '') {
      emit('warn', metadata, message);
    },
    error(metadata, message = '') {
      emit('error', metadata, message);
    },
  });
}
