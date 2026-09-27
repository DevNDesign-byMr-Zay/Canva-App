// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
const boundary = vi.hoisted(() => ({ render: vi.fn(), load: vi.fn(), prepare: vi.fn() }));
vi.mock("@canva/app-ui-kit/styles.css", () => ({}));
vi.mock("react-dom/client", () => ({ createRoot: () => ({ render: boundary.render }) }));
vi.mock("@canva/intents/design", () => ({ prepareDesignEditor: boundary.prepare }));
vi.mock("@canva/app-i18n-kit", () => ({
  AppI18nProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@canva/app-ui-kit", () => ({
  AppUiProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./app", () => ({ App: () => null }));
vi.mock("./review-context-mount", () => ({ resolveReviewContextForMount: boundary.load }));
import designEditor from "./index";
beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '<div id="root"></div>';
});
it("registers the Design Editor intent at the application entrypoint", async () => {
  await import("../../index");
  expect(boundary.prepare).toHaveBeenCalledWith(designEditor);
});
it("fails clearly if the host does not provide a root element", async () => {
  document.body.innerHTML = "";
  await expect(designEditor.render()).rejects.toThrow("root element");
  expect(boundary.load).not.toHaveBeenCalled();
});
it.each([
  null,
  { scenario: { scenarioId: "trusted" }, trustedDesignId: "design-1", trustedPageId: "page-1" },
])("renders only the resolved trusted context: %j", async (context) => {
  boundary.load.mockResolvedValue(context);
  await designEditor.render();
  const tree = boundary.render.mock.calls[0][0];
  expect(tree.props.children.props.children.props).toEqual({
    scenario: context?.scenario ?? null,
    trustedDesignId: context?.trustedDesignId,
    trustedPageId: context?.trustedPageId,
  });
});
