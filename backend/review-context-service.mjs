import http from 'node:http';
import { pathToFileURL } from 'node:url';

import * as canvaDesign from '@canva/app-middleware/design';
import * as canvaUser from '@canva/app-middleware/user';

import { createErrorReporter } from './error-reporting.mjs';
import { createJsonLogger } from './logging.mjs';

const DEFAULT_SERVICE_VERSION = '1.1.3';
const MAX_BODY_BYTES = 64 * 1024;

function requireText(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function requireHttpUrl(value, name) {
  const text = requireText(value, name);
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    throw new TypeError(`${name} must be a valid HTTP or HTTPS URL`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new TypeError(`${name} must be a valid HTTP or HTTPS URL`);
  }
  return parsed.href;
}

function middlewareVerifier(handler, name) {
  if (typeof handler !== 'function') throw new TypeError(`${name} middleware handler must be a function`);
  return {
    async verify(token, { request = null, body = null } = {}) {
      if (typeof token !== 'string' || !token.trim()) throw new TypeError('token must be a non-empty string');
      let status = 200;
      let responseHeader = null;
      let responseBody = null;
      let nextCalled = false;

      const dummyReq = Object.assign(Object.create(request ?? {}), {
        headers: {
          ...(request?.headers ?? {}),
          authorization: `Bearer ${token.trim()}`,
        },
        body: body ?? {},
      });

      const dummyRes = {
        status(code) {
          status = code;
          return this;
        },
        setHeader(name, value) {
          if (String(name).toLowerCase() === 'www-authenticate') responseHeader = value;
          return this;
        },
        json(data) {
          responseBody = data;
          return this;
        },
      };

      await new Promise((resolve, reject) => {
        try {
          handler(dummyReq, dummyRes, (err) => {
            if (err) reject(err);
            else {
              nextCalled = true;
              resolve();
            }
          });
        } catch (err) {
          reject(err);
        }
      });

      if (!nextCalled || status >= 400) {
        const message =
          responseHeader ||
          (typeof responseBody === 'object' && responseBody?.error) ||
          `verification failed with status ${status}`;
        throw new Error(String(message));
      }

      const payload = dummyReq.canvaUser ?? dummyReq.canvaDesign;
      if (!payload || typeof payload !== 'object') {
        throw new TypeError('verification completed without setting payload on request');
      }
      return payload;
    },
  };
}

function designTokenFromBody(req) {
  const body = req?.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  return typeof body.designToken === 'string' && body.designToken.trim() ? body.designToken.trim() : null;
}

function snapshotJson(value, label) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    throw new TypeError(`${label} must be serializable to JSON`);
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }
  return Object.freeze(value);
}

function responseHeaders(allowedOrigin, requestOrigin) {
  return {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': allowedOrigin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'Authorization, Content-Type',
    'access-control-max-age': '600',
    vary: 'Origin',
    ...(requestOrigin && requestOrigin !== allowedOrigin ? {} : {}),
  };
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

export function validateReviewContextRequest(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('request body must be an object');
  }
  const allowedKeys = new Set(['designToken']);
  const extraKeys = Object.keys(parsed).filter((key) => !allowedKeys.has(key));
  if (extraKeys.length > 0) {
    throw new TypeError('request body contains unsupported fields');
  }
  if (typeof parsed.designToken !== 'string' || !parsed.designToken.trim()) {
    throw new TypeError('request body must include a valid designToken string');
  }
  return { designToken: parsed.designToken.trim() };
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
  return validateReviewContextRequest(parsed);
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
  logger = createJsonLogger(),
  onError = null,
  startedAt = Date.now(),
  serviceVersion = DEFAULT_SERVICE_VERSION,
} = {}) {
  const resolvedAppId = requireText(appId, 'appId');
  const resolvedOrigin = new URL(requireText(allowedOrigin, 'allowedOrigin')).origin;
  const resolvedVersion = requireText(serviceVersion, 'serviceVersion');
  if (!Number.isFinite(startedAt) || startedAt < 0) throw new TypeError('startedAt must be a finite timestamp');
  const reportError = createErrorReporter({ onError, logger });
  const user =
    userVerifier ??
    middlewareVerifier(canvaUser.verifyToken({ appId: resolvedAppId }), 'user');
  const design =
    designVerifier ??
    middlewareVerifier(
      canvaDesign.verifyToken({ appId: resolvedAppId, tokenExtractor: designTokenFromBody }),
      'design',
    );

  if (typeof user?.verify !== 'function' || typeof design?.verify !== 'function') {
    throw new TypeError('Canva user and design token verifiers are required');
  }
  const scenarioLoader =
    loadScenario ??
    createRemoteScenarioSource({
      endpoint: requireHttpUrl(sourceUrl, 'sourceUrl'),
      fetchImpl,
    });
  if (typeof scenarioLoader !== 'function') throw new TypeError('loadScenario must be a function');

  return http.createServer(async (req, res) => {
    const requestOrigin = typeof req.headers.origin === 'string' ? req.headers.origin : null;
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(
        res,
        200,
        {
          service: 'canva-review-context',
          status: 'ok',
          uptimeSeconds: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
          version: resolvedVersion,
        },
        resolvedOrigin,
        requestOrigin,
      );
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
      reportError(error, { scope: 'review-context-source', designId });
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

export async function startReviewContextService(
  environment = process.env,
  { logger = createJsonLogger(), serviceVersion = DEFAULT_SERVICE_VERSION } = {},
) {
  const config = parseReviewContextConfig(environment);
  const server = createReviewContextServer({ ...config, logger, serviceVersion });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, '0.0.0.0', resolve);
  });
  logger.info(
    {
      event: 'review_context_service_started',
      port: config.port,
      version: serviceVersion,
    },
    'Review context service started',
  );
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const logger = createJsonLogger();
  startReviewContextService(process.env, { logger }).catch((error) => {
    logger.error(
      {
        event: 'review_context_service_start_failed',
        errorName: error instanceof Error ? error.name : 'Error',
      },
      'Review context service failed to start',
    );
    process.exitCode = 1;
  });
}
