import { getDesignToken } from "@canva/design";
import { auth } from "@canva/user";

import {
  loadTrustedReviewContext,
  type LoadTrustedReviewContextOptions,
  type TrustedReviewContext,
} from "./review-context-client";

declare const BACKEND_HOST: string;

type LoadContext = (options: LoadTrustedReviewContextOptions) => Promise<TrustedReviewContext>;

export async function loadProductionReviewContext({
  backendHost = BACKEND_HOST,
  loadContext = loadTrustedReviewContext,
}: {
  backendHost?: string;
  loadContext?: LoadContext;
} = {}): Promise<TrustedReviewContext> {
  const host = typeof backendHost === "string" ? backendHost.trim().replace(/\/+$/u, "") : "";
  if (!host) throw new TypeError("Canva backend host is unavailable");

  return loadContext({
    endpoint: `${host}/review-context`,
    getDesignToken,
    getUserToken: () => auth.getCanvaUserToken(),
  });
}

export async function resolveReviewContextForMount(
  options: Parameters<typeof loadProductionReviewContext>[0] = {},
): Promise<TrustedReviewContext | null> {
  try {
    return await loadProductionReviewContext(options);
  } catch {
    return null;
  }
}
