import type { HoloForgeScenario } from "./scenario-contract";

export type TrustedReviewContext = Readonly<{
  scenario: HoloForgeScenario;
  trustedDesignId: string;
  trustedPageId?: string;
}>;

type DesignTokenResult = Readonly<{ token: string }>;
type TokenSource<T> = () => Promise<T>;
type ReviewContextResponse = Pick<Response, "ok" | "status" | "json">;
type ReviewContextFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<ReviewContextResponse>;

export type LoadTrustedReviewContextOptions = Readonly<{
  endpoint: string;
  getDesignToken: TokenSource<DesignTokenResult>;
  getUserToken: TokenSource<string>;
  fetchImpl?: ReviewContextFetch;
}>;

function nonEmptyText(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function trustedEndpoint(value: unknown): string {
  const endpoint = nonEmptyText(value, "endpoint");
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new TypeError("endpoint must be a valid absolute URL");
  }
  if (parsed.protocol !== "https:") {
    throw new TypeError("endpoint must use HTTPS");
  }
  if (parsed.username || parsed.password) {
    throw new TypeError("endpoint must not contain URL credentials");
  }
  if (parsed.hash) {
    throw new TypeError("endpoint must not contain a URL fragment");
  }
  return parsed.href;
}

function snapshotJson(value: unknown, path = "review context", seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`${path} numbers must be finite`);
    return value;
  }
  if (!value || typeof value !== "object") {
    throw new TypeError(`${path} must contain JSON-compatible data`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError(`${path} must not contain symbol properties`);
  }
  if (seen.has(value)) throw new TypeError(`${path} must not contain circular references`);
  seen.add(value);

  let copy: unknown;
  if (Array.isArray(value)) {
    const allowedKeys = new Set(["length"]);
    const output: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const key = String(index);
      allowedKeys.add(key);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor) throw new TypeError(`${path} must not contain sparse arrays`);
      if ("get" in descriptor || "set" in descriptor) {
        throw new TypeError(`${path}[${index}] must not use accessors`);
      }
      output.push(snapshotJson(descriptor.value, `${path}[${index}]`, seen));
    }
    if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || !allowedKeys.has(key))) {
      throw new TypeError(`${path} arrays must not contain extra properties`);
    }
    copy = output;
  } else {
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new TypeError(`${path} must use plain objects`);
    }
    const output: Record<string, unknown> = {};
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (!descriptor.enumerable) throw new TypeError(`${path}.${key} must be enumerable`);
      if ("get" in descriptor || "set" in descriptor) {
        throw new TypeError(`${path}.${key} must not use accessors`);
      }
      Object.defineProperty(output, key, {
        value: snapshotJson(descriptor.value, `${path}.${key}`, seen),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    copy = output;
  }

  seen.delete(value);
  return copy;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function parseTrustedReviewContext(value: unknown): TrustedReviewContext {
  const captured = snapshotJson(value) as Record<string, unknown>;
  const allowedKeys = new Set(["scenario", "trustedDesignId", "trustedPageId"]);
  const unexpectedKey = Object.keys(captured).find((key) => !allowedKeys.has(key));
  if (unexpectedKey) {
    throw new TypeError(`review context contains unsupported field: ${unexpectedKey}`);
  }

  const trustedDesignId = nonEmptyText(captured.trustedDesignId, "trustedDesignId");
  const trustedPageId =
    captured.trustedPageId === undefined
      ? undefined
      : nonEmptyText(captured.trustedPageId, "trustedPageId");
  const scenario = captured.scenario as HoloForgeScenario | undefined;
  if (!scenario || typeof scenario !== "object") {
    throw new TypeError("review context requires a canonical scenario");
  }
  if (scenario.contractVersion !== 1 || !scenario.scenarioId?.trim()) {
    throw new TypeError("review context requires a version-1 canonical scenario");
  }
  if (scenario.source?.designId !== trustedDesignId) {
    throw new TypeError("scenario design identity does not match the trusted design target");
  }
  if (trustedPageId && !scenario.source.pageIds?.includes(trustedPageId)) {
    throw new TypeError("scenario page scope does not contain the trusted page target");
  }
  if (
    scenario.presentation?.advisoryOnly !== true ||
    scenario.presentation?.autoApply !== false ||
    scenario.presentation?.target !== "web-dashboard"
  ) {
    throw new TypeError("scenario presentation boundary must remain advisory and explicit-apply only");
  }

  return deepFreeze({
    scenario,
    trustedDesignId,
    ...(trustedPageId ? { trustedPageId } : {}),
  });
}

export async function loadTrustedReviewContext({
  endpoint,
  getDesignToken,
  getUserToken,
  fetchImpl = globalThis.fetch,
}: LoadTrustedReviewContextOptions): Promise<TrustedReviewContext> {
  const normalizedEndpoint = trustedEndpoint(endpoint);
  if (typeof getDesignToken !== "function" || typeof getUserToken !== "function") {
    throw new TypeError("fresh Canva token sources are required");
  }
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function");

  const [designTokenResult, userTokenValue] = await Promise.all([
    getDesignToken(),
    getUserToken(),
  ]);
  const designToken = nonEmptyText(designTokenResult?.token, "design token");
  const userToken = nonEmptyText(userTokenValue, "user token");

  const response = await fetchImpl(normalizedEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${userToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ designToken }),
  });
  if (!response.ok) {
    throw new Error(`trusted review context request failed with status ${response.status}`);
  }

  return parseTrustedReviewContext(await response.json());
}
