import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "../src/intents/design_editor/app";

declare global {
  interface Window {
    __DEPTHPOP_E2E_SCENE__?: unknown;
  }
}

const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const response = await originalFetch(input, init);
  const requestUrl =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();

  if (
    method === "GET" &&
    /\/api\/v1\/scenes\/scene_[^/]+$/.test(requestUrl) &&
    response.ok
  ) {
    try {
      window.__DEPTHPOP_E2E_SCENE__ = await response.clone().json();
    } catch {
      // The CDP runner will fail if a valid scene is never captured.
    }
  }
  return response;
};

const root = document.getElementById("root");
if (!root) throw new Error("E2E root element is missing");

createRoot(root).render(<App />);
