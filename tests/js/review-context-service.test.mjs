import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';

import {
  createRemoteScenarioSource,
  createReviewContextServer,
  parseReviewContextConfig,
} from '../../backend/review-context-service.mjs';

function scenario(designId = 'design-1', pageIds = ['page-1']) {
  return {
    contractVersion: 1,
    scenarioId: 'scenario-1',
    source: {
      designId,
      snapshotId: 'snapshot-1',
      pageIds,
      snapshotFingerprint: 'a'.repeat(64),
    },
    intent: {
      summary: 'Improve layout',
      objectiveId: 'layout-balance',
      objectiveDirection: 'maximize',
    },
    constraints: { hard: [], soft: [] },
    candidate: {
      layout: { elements: {} },
      changedElementIds: [],
      delta: {},
    },
    evidence: {
      backend: 'maintained-upstream',
      algorithm: 'deterministic',
      seed: '1',
      status: 'ready',
      objectiveScore: 1,
      baseline: { backend: 'maintained-upstream', algorithm: 'baseline', objectiveScore: 0 },
      objectiveGap: 1,
      durationMs: 1,
      hardConstraintsPassed: true,
      warnings: [],
    },
    interpretation: {
      producer: 'upstream',
      label: 'review',
      summary: 'Review before applying.',
      tradeoffs: [],
    },
    presentation: {
      advisoryOnly: true,
      autoApply: false,
      target: 'web-dashboard',
    },
    provenance: {
      scenarioFingerprint: 'b'.repeat(64),
      optimizationFingerprint: 'c'.repeat(64),
    },
  };
}

async function startServer(overrides = {}) {
  const calls = [];
  const userVerifier = overrides.userVerifier ?? {
    async verify(token) {
      calls.push({ kind: 'user', token });
      return { userId: 'user-1', brandId: 'brand-1', appId: 'app-1' };
    },
  };
  const designVerifier = overrides.designVerifier ?? {
    async verify(token) {
      calls.push({ kind: 'design', token });
      return { designId: 'design-1', appId: 'app-1' };
    },
  };
  const sourceCalls = [];
  const loadScenario =
    overrides.loadScenario ??
    (async (input) => {
      sourceCalls.push(input);
      return { scenario: scenario(input.designId), trustedPageId: 'page-1' };
    });

  const server = createReviewContextServer({
    appId: 'app-1',
    allowedOrigin: 'https://app.example.test',
    userVerifier,
    designVerifier,
    loadScenario,
    logger: overrides.logger ?? { info() {}, warn() {} },
    onError: overrides.onError ?? null,
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.equal(typeof address, 'object');

  return {
    base: `http://127.0.0.1:${address.port}`,
    calls,
    sourceCalls,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function requestOptions(body = { designToken: 'fresh-design-token' }) {
  return {
    method: 'POST',
    headers: {
      Authorization: 'Bearer fresh-user-token',
      'Content-Type': 'application/json',
      Origin: 'https://app.example.test',
    },
    body: JSON.stringify(body),
  };
}

test('issues trusted review context only from independently verified identities', async (t) => {
  const runtime = await startServer();
  t.after(runtime.close);

  const response = await fetch(`${runtime.base}/review-context`, requestOptions());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    scenario: scenario('design-1'),
    trustedDesignId: 'design-1',
    trustedPageId: 'page-1',
  });
  assert.deepEqual(runtime.calls, [
    { kind: 'user', token: 'fresh-user-token' },
    { kind: 'design', token: 'fresh-design-token' },
  ]);
  assert.deepEqual(runtime.sourceCalls, [
    { designId: 'design-1', userId: 'user-1', brandId: 'brand-1' },
  ]);
  assert.equal(JSON.stringify(runtime.sourceCalls).includes('fresh-user-token'), false);
  assert.equal(JSON.stringify(runtime.sourceCalls).includes('fresh-design-token'), false);
});

test('fails closed for missing, invalid, or cross-design identity', async (t) => {
  const invalidUser = await startServer({
    userVerifier: {
      async verify() {
        throw new Error('invalid token');
      },
    },
  });
  t.after(invalidUser.close);
  const unauthorized = await fetch(
    `${invalidUser.base}/review-context`,
    requestOptions(),
  );
  assert.equal(unauthorized.status, 401);

  const mismatched = await startServer({
    loadScenario: async () => ({ scenario: scenario('other-design') }),
  });
  t.after(mismatched.close);
  const mismatchResponse = await fetch(
    `${mismatched.base}/review-context`,
    requestOptions(),
  );
  assert.equal(mismatchResponse.status, 502);
  assert.deepEqual(await mismatchResponse.json(), {
    error: 'review_context_unavailable',
  });
});

test('rejects unsupported source fields and untrusted page targets', async (t) => {
  const extraField = await startServer({
    loadScenario: async () => ({ scenario: scenario(), trustedDesignId: 'source-controlled' }),
  });
  t.after(extraField.close);
  assert.equal(
    (
      await fetch(
        `${extraField.base}/review-context`,
        requestOptions(),
      )
    ).status,
    502,
  );

  const pageMismatch = await startServer({
    loadScenario: async () => ({ scenario: scenario(), trustedPageId: 'page-2' }),
  });
  t.after(pageMismatch.close);
  assert.equal(
    (
      await fetch(
        `${pageMismatch.base}/review-context`,
        requestOptions(),
      )
    ).status,
    502,
  );
});

test('enforces request shape and exact configured origin', async (t) => {
  const runtime = await startServer();
  t.after(runtime.close);

  const extra = await fetch(
    `${runtime.base}/review-context`,
    requestOptions({ designToken: 'fresh-design-token', extra: true }),
  );
  assert.equal(extra.status, 400);

  const wrongOrigin = await fetch(`${runtime.base}/review-context`, {
    ...requestOptions(),
    headers: {
      ...requestOptions().headers,
      Origin: 'https://attacker.example',
    },
  });
  assert.equal(wrongOrigin.status, 403);

  const preflight = await fetch(`${runtime.base}/review-context`, {
    method: 'OPTIONS',
    headers: { Origin: 'https://app.example.test' },
  });
  assert.equal(preflight.status, 204);
  assert.equal(
    preflight.headers.get('access-control-allow-origin'),
    'https://app.example.test',
  );
});

test('remote scenario source sends verified IDs instead of Canva JWTs', async () => {
  let request;
  const loadScenario = createRemoteScenarioSource({
    endpoint: 'https://scenario.example.test/context',
    fetchImpl: async (url, init) => {
      request = { url, init };
      return {
        ok: true,
        status: 200,
        async json() {
          return { scenario: scenario('design-1') };
        },
      };
    },
  });

  await loadScenario({
    designId: 'design-1',
    userId: 'user-1',
    brandId: 'brand-1',
  });

  assert.equal(request.url, 'https://scenario.example.test/context');
  assert.deepEqual(JSON.parse(request.init.body), {
    designId: 'design-1',
    userId: 'user-1',
    brandId: 'brand-1',
  });
  assert.equal(request.init.headers.Authorization, undefined);
});

test('review-context backend configuration is explicit and secret-free', () => {
  assert.deepEqual(
    parseReviewContextConfig({
      CANVA_APP_ID: 'app-1',
      CANVA_APP_ORIGIN: 'https://app.example.test/path',
      REVIEW_CONTEXT_SOURCE_URL: 'https://scenario.example.test/context',
      PORT: '8081',
    }),
    {
      appId: 'app-1',
      allowedOrigin: 'https://app.example.test',
      sourceUrl: 'https://scenario.example.test/context',
      port: 8081,
    },
  );

  assert.throws(
    () =>
      parseReviewContextConfig({
        CANVA_APP_ORIGIN: 'https://app.example.test',
        REVIEW_CONTEXT_SOURCE_URL: 'https://scenario.example.test/context',
      }),
    /CANVA_APP_ID/,
  );
});


test('reports upstream failures with bounded context without exposing request tokens', async (t) => {
  const reports = [];
  const runtime = await startServer({
    loadScenario: async () => {
      throw new Error('upstream failed');
    },
    onError(error, context) {
      reports.push({ error, context });
    },
  });
  t.after(runtime.close);

  const response = await fetch(`${runtime.base}/review-context`, requestOptions());
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: 'review_context_unavailable' });
  assert.equal(reports.length, 1);
  assert.equal(reports[0].error.message, 'upstream failed');
  assert.deepEqual(reports[0].context, {
    scope: 'review-context-source',
    designId: 'design-1',
  });
  assert.equal(Object.isFrozen(reports[0].context), true);
  assert.equal(JSON.stringify(reports).includes('fresh-user-token'), false);
  assert.equal(JSON.stringify(reports).includes('fresh-design-token'), false);
});

test('reporter failures are isolated from the sanitized 502 response', async (t) => {
  const warnings = [];
  const runtime = await startServer({
    loadScenario: async () => {
      throw new Error('source unavailable');
    },
    onError() {
      throw new Error('telemetry unavailable');
    },
    logger: {
      info() {},
      warn(metadata, message) {
        warnings.push({ metadata, message });
      },
    },
  });
  t.after(runtime.close);

  const response = await fetch(`${runtime.base}/review-context`, requestOptions());
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: 'review_context_unavailable' });
  assert.ok(
    warnings.some(
      ({ metadata, message }) =>
        metadata.event === 'error_reporter_failed' &&
        metadata.errorName === 'Error' &&
        message === 'Error reporter failed',
    ),
  );
  assert.equal(JSON.stringify(warnings).includes('telemetry unavailable'), false);
});
