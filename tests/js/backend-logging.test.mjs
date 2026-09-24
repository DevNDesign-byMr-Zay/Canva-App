import assert from 'node:assert/strict';
import test from 'node:test';

import { createJsonLogger } from '../../backend/logging.mjs';

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
