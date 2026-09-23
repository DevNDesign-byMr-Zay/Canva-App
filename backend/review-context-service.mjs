import http from 'node:http';
import { pathToFileURL } from 'node:url';

import { design as canvaDesign, user as canvaUser } from '@canva/app-middleware/express';

const MAX_BODY_BYTES = 64 * 1024;

function requireText(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function requireHttpUrl(value, name) {
  const url = new URL(requireText(value, name));
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new TypeError(`${name} must use http or https`);
  }
  return url.toString();
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function snapshotJson(value, path = 'payload', seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${path} numbers must be finite`);
    return value;
  }
  if (!value || typeof value !== 'object') {
    throw new TypeError(`${path} must contain JSON-compatible data`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError(`${path} must not contain symbol properties`);
  }
  if (seen.has(value)) throw new TypeError(`${path} must not contain circular references`);
  seen.add(value);

  let copy;
  if (Array.isArray(value)) {
    copy = value.map((item, index) => snapshotJson(item, `${path}[${index}]`, seen));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`${path} must use plain objects`);
    }
    copy = {};
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (!descriptor.enumerable || 'get' in descriptor || 'set' in descriptor) {
        throw new TypeError(`${path}.${key} must be enumerable data`);
      }
      Object.defineProperty(copy, key, {
        value: snapshotJson(descriptor.value, `${path}.${key}`, seen),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
  }

  seen.delete(value);
  return copy;
}

function middlewareVerifier(middleware, kind) {
  if (typeof middleware !== 'function') throw new TypeError('Canva token middleware is required');

  return Object.freeze({
    async verify(_token, { request, body } = {}) {
      if (!request || typeof request !== 'object') {
        throw new TypeError('request is required for Canva token verification');
      }
      request.body = body;

      await new Promise((resolve, reject) => {
        let settled = false;
        const next = (error) => {
          if (settled) return;
          settled = true;
          if (error) reject(error);
          else resolve();
        };

        try {
          Promise.resolve(middleware(request, {}, next)).catch(reject);
        } catch (error) {
          reject(error);
        }
      });

      const payload = request.canva?.[kind];
      if (!payload || typeof payload !== 'object') {
        throw new TypeError(`verified Canva ${kind} identity is unavailable`);
      }
      return payload;
    },
  });
}

function designTokenFromBody(request) {
  const token = request?.body?.designToken;
  return typeof token === 'string' && token.trim() ? token.trim() : undefined;
}

function responseHeaders(allowedOrigin, requestOrigin) {
  const headers = {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  };
  if (requestOrigin && requestOrigin === allowedOrigin) {
    headers['access-control-allow-origin'] = allowedOrigin;
    headers.vary = 'Origin';
  }
  return headers;
}

function sendJson(res, statusCode, body, allowedOrigin, requestOrigin) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    ...responseHeaders(allowedOrigin, requestOrigin),
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function extractBearerToken(headerValue) {
  if (typeof headerValue !== 'string') return null;
  const match = /^Bearer\s+(.+)$/iu.exec(headerValue.trim());
  return match ? match[1].trim() || null : null;
}

async function readJsonBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new RangeError('request body is too large');
    chunks.push(chunk);
  }

  let parsed;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new TypeError('request body must be valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('request body must be an object');
  }
  if (Object.keys(parsed).some((key) => key !== 'designToken')) {
    throw new TypeError('request body contains unsupported fields');
  }
  return parsed;
}

function validateScenarioEnvelope(value, designId) {
  const captured = snapshotJson(value, 'scenario source response');
  if (!captured || typeof captured !== 'object' || Array.isArray(captured)) {
    throw new TypeError('scenario source response must be an object');
  }
  const allowedKeys = new Set(['scenario', 'trustedPageId']);
  const unexpectedKey = Object.keys(captured).find((key) => !allowedKeys.has(key));
  if (unexpectedKey) {
    throw new TypeError(`scenario source response contains unsupported field: ${unexpectedKey}`);
  }

  const scenario = captured.scenario;
  if (!scenario || typeof scenario !== 'object' || Array.isArray(scenario)) {
    throw new TypeError('scenario source must return a canonical scenario');
  }
  if (scenario.contractVersion !== 1 || typeof scenario.scenarioId !== 'string' || !scenario.scenarioId.trim()) {
    throw new TypeError('scenario source must return a version-1 canonical scenario');
  }
  if (!scenario.source || typeof scenario.source !== 'object' || Array.isArray(scenario.source)) {
    throw new TypeError('scenario source identity is required');
  }
  if (scenario.source.designId !== designId) {
    throw new TypeError('canonical scenario design identity does not match the verified design token');
  }
  if (!Array.isArray(scenario.source.pageIds)) {
    throw new TypeError('canonical scenario page scope must be an array');
  }
  if (
    !scenario.presentation ||
    scenario.presentation.advisoryOnly !== true ||
    scenario.presentation.autoApply !== false ||
    scenario.presentation.target !== 'web-dashboard'
  ) {
    throw new TypeError('canonical scenario must remain advisory and explicit-apply only');
  }

  const trustedPageId =
    captured.trustedPageId === undefined
      ? undefined
      : requireText(captured.trustedPageId, 'trustedPageId');
  if (trustedPageId && !scenario.source.pageIds.includes(trustedPageId)) {
    throw new TypeError('trusted page target is outside the canonical scenario page scope');
  }

  return deepFreeze({
    scenario,
    trustedDesignId: designId,
    ...(trustedPageId ? { trustedPageId } : {}),
  });
}

export function createRemoteScenarioSource({ endpoint, fetchImpl = globalThis.fetch } = {}) {
  const sourceUrl = requireHttpUrl(endpoint, 'scenario source endpoint');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');

  return async function loadScenario({ designId, userId, brandId = null } = {}) {
    const response = await fetchImpl(sourceUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        designId: requireText(designId, 'designId'),
        userId: requireText(userId, 'userId'),
        ...(typeof brandId === 'string' && brandId.trim() ? { brandId: brandId.trim() } : {}),
      }),
    });
    if (!response?.ok) {
      throw new Error(`canonical scenario source failed with status ${response?.status ?? 'unknown'}`);
    }
    return response.json();
  };
}

export function createReviewContextServer({
  appId,
  allowedOrigin,
  sourceUrl,
  userVerifier,
  designVerifier,
  loadScenario,
  fetchImpl = globalThis.fetch,
  logger = console,
} = {}) {
  const resolvedAppId = requireText(appId, 'appId');
  const resolvedOrigin = new URL(requireText(allowedOrigin, 'allowedOrigin')).origin;
  const user =
    userVerifier ??
    middlewareVerifier(canvaUser.verifyToken({ appId: resolvedAppId }), 'user');
  const design =
    designVerifier ??
    middlewareVerifier(
      canvaDesign.verifyToken({ appId: resolvedAppId, tokenExtractor: designTokenFromBody }),
      'design',
    );
  const scenarioLoader =
    loadScenario ??
    createRemoteScenarioSource({
      endpoint: requireHttpUrl(sourceUrl, 'sourceUrl'),
      fetchImpl,
    });

  if (typeof user?.verify !== 'function' || typeof design?.verify !== 'function') {
    throw new TypeError('Canva user and design token verifiers are required');
  }
  if (typeof scenarioLoader !== 'function') throw new TypeError('loadScenario must be a function');

  return http.createServer(async (req, res) => {
    const requestOrigin = typeof req.headers.origin === 'string' ? req.headers.origin : null;
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { service: 'canva-review-context', status: 'ok' }, resolvedOrigin, requestOrigin);
      return;
    }

    if (url.pathname !== '/review-context') {
      sendJson(res, 404, { error: 'not_found' }, resolvedOrigin, requestOrigin);
      return;
    }

    if (requestOrigin && requestOrigin !== resolvedOrigin) {
      sendJson(res, 403, { error: 'origin_not_allowed' }, resolvedOrigin, requestOrigin);
      return;
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': resolvedOrigin,
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'Authorization, Content-Type',
        'access-control-max-age': '600',
        vary: 'Origin',
      });
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'method_not_allowed' }, resolvedOrigin, requestOrigin);
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      const statusCode = error instanceof RangeError ? 413 : 400;
      sendJson(res, statusCode, { error: 'invalid_request' }, resolvedOrigin, requestOrigin);
      return;
    }

    const userToken = extractBearerToken(req.headers.authorization);
    const designToken =
      typeof body.designToken === 'string' && body.designToken.trim() ? body.designToken.trim() : null;
    if (!userToken || !designToken) {
      sendJson(res, 401, { error: 'unauthorized' }, resolvedOrigin, requestOrigin);
      return;
    }

    let userPayload;
    let designPayload;
    try {
      userPayload = await user.verify(userToken, { request: req, body });
      designPayload = await design.verify(designToken, { request: req, body });
    } catch {
      sendJson(res, 401, { error: 'unauthorized' }, resolvedOrigin, requestOrigin);
      return;
    }

    let userId;
    let designId;
    try {
      userId = requireText(userPayload?.userId, 'verified userId');
      designId = requireText(designPayload?.designId, 'verified designId');
    } catch {
      sendJson(res, 401, { error: 'unauthorized' }, resolvedOrigin, requestOrigin);
      return;
    }

    try {
      const sourceEnvelope = await scenarioLoader({
        designId,
        userId,
        brandId: userPayload?.brandId ?? null,
      });
      const context = validateScenarioEnvelope(sourceEnvelope, designId);
      logger.info?.({
        event: 'review_context_issued',
        designId,
        userId,
        pageScoped: Boolean(context.trustedPageId),
      });
      sendJson(res, 200, context, resolvedOrigin, requestOrigin);
    } catch (error) {
      logger.warn?.({
        event: 'review_context_source_failed',
        designId,
        errorName: error instanceof Error ? error.name : 'Error',
      });
      sendJson(res, 502, { error: 'review_context_unavailable' }, resolvedOrigin, requestOrigin);
    }
  });
}

export function parseReviewContextConfig(environment = process.env) {
  const port = Number(environment.PORT ?? 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new TypeError('PORT must be an integer between 1 and 65535');
  }
  return Object.freeze({
    appId: requireText(environment.CANVA_APP_ID, 'CANVA_APP_ID'),
    allowedOrigin: new URL(requireText(environment.CANVA_APP_ORIGIN, 'CANVA_APP_ORIGIN')).origin,
    sourceUrl: requireHttpUrl(environment.REVIEW_CONTEXT_SOURCE_URL, 'REVIEW_CONTEXT_SOURCE_URL'),
    port,
  });
}

export async function startReviewContextService(environment = process.env) {
  const config = parseReviewContextConfig(environment);
  const server = createReviewContextServer(config);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, '0.0.0.0', resolve);
  });
  console.info(
    JSON.stringify({
      event: 'review_context_service_started',
      port: config.port,
    }),
  );
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startReviewContextService().catch((error) => {
    console.error(
      JSON.stringify({
        event: 'review_context_service_start_failed',
        errorName: error instanceof Error ? error.name : 'Error',
      }),
    );
    process.exitCode = 1;
  });
}
