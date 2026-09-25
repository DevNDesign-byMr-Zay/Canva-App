import assert from 'node:assert/strict';
import test from 'node:test';

import { createJsonLogger } from '../../backend/logging.mjs';
import { createErrorReporter } from '../../backend/error-reporting.mjs';

test('structured logger emits stable JSON metadata', () => {
  const lines = [];
  const sink = {
    info(line) {
      lines.push(line);
    },
    warn(line) {
      lines.push(line);
    },
    error(line) {
      lines.push(line);
    },
  };
  const logger = createJsonLogger({
    name: 'review-context-test',
    sink,
    now: () => '2026-09-24T19:30:00.000Z',
  });

  logger.info({ event: 'health_check', statusCode: 200 }, 'Health check');

  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), {
    timestamp: '2026-09-24T19:30:00.000Z',
    level: 'info',
    logger: 'review-context-test',
    message: 'Health check',
    event: 'health_check',
    statusCode: 200,
  });
});

test('structured logger preserves level-specific sink routing', () => {
  const calls = [];
  const sink = {
    info(line) {
      calls.push(['info', line]);
    },
    warn(line) {
      calls.push(['warn', line]);
    },
    error(line) {
      calls.push(['error', line]);
    },
  };
  const logger = createJsonLogger({ sink, now: () => '2026-09-24T19:30:00.000Z' });

  logger.warn({ event: 'warning' }, 'Warning');
  logger.error({ event: 'failure' }, 'Failure');

  assert.deepEqual(
    calls.map(([method, line]) => [method, JSON.parse(line).level]),
    [
      ['warn', 'warn'],
      ['error', 'error'],
    ],
  );
});

test('structured logger rejects invalid construction and metadata while tolerating partial sinks', () => {
  assert.throws(() => createJsonLogger({ name: '' }), /logger name/);
  assert.throws(() => createJsonLogger({ sink: null }), /log sink/);
  assert.throws(() => createJsonLogger({ now: 'not-a-function' }), /now must be a function/);

  const logger = createJsonLogger({ sink: {}, now: () => '2026-09-24T19:30:00.000Z' });
  assert.doesNotThrow(() => logger.info({}, null));
  assert.throws(() => logger.info([]), /log metadata must be an object/);
  assert.throws(() => logger.warn(null), /log metadata must be an object/);
});

test('error reporter validates configuration and safely ignores absent callbacks', () => {
  assert.throws(() => createErrorReporter({ onError: 'not-a-function' }), /onError must be a function/);
  assert.doesNotThrow(() => createErrorReporter()({ message: 'ignored' }));
});

test('error reporter bounds supplied context and contains synchronous callback failures', () => {
  const warnings = [];
  const reporter = createErrorReporter({
    onError() {
      throw new RangeError('sink unavailable');
    },
    logger: { warn(...args) { warnings.push(args); } },
  });

  reporter(new Error('upstream failure'), { scope: ' trusted-scope ', designId: ' design-123 ' });
  assert.deepEqual(warnings, [[{ event: 'error_reporter_failed', errorName: 'RangeError' }, 'Error reporter failed']]);
  assert.throws(() => reporter(new Error('upstream failure'), { scope: '' }), /scope must be a non-empty string/);
  assert.throws(() => reporter(new Error('upstream failure'), { designId: 'x'.repeat(129) }), /designId must be a non-empty string/);
});

test('error reporter contains asynchronous callback failures', async () => {
  const warnings = [];
  const reporter = createErrorReporter({
    onError: async () => { throw new Error('async sink unavailable'); },
    logger: { warn(...args) { warnings.push(args); } },
  });

  reporter(new Error('upstream failure'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(warnings, [[{ event: 'error_reporter_failed', errorName: 'Error' }, 'Error reporter failed']]);
});
