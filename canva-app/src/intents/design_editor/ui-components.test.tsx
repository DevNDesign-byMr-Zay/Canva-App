import React from "react";
import { renderToString } from "react-dom/server";
import { createIntl, createIntlCache, RawIntlProvider } from "react-intl";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@canva/design", () => ({
  initAppElement: () => ({ addElement: vi.fn(async () => undefined) }),
}));

if (typeof globalThis.document === "undefined") {
  (globalThis as unknown as { document: unknown }).document = {
    documentElement: { getAttribute: () => "en", lang: "en" },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}
if (typeof globalThis.navigator === "undefined") {
  (globalThis as unknown as { navigator: unknown }).navigator = { userAgent: "node" };
}
if (typeof globalThis.window === "undefined") {
  (globalThis as unknown as { window: unknown }).window = {
    __canva__: { locale: "en" },
    cmsg: { locale: "en" },
    canva_sdk: {
      platform: { v2: { i18n: { getTranslations: async () => ({}) } } },
    },
    navigator: { userAgent: "node" },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

describe("HoloForge studio sidebar components", () => {
  let AppUiProvider: typeof import("@canva/app-ui-kit").AppUiProvider;
  let StudioTabs: typeof import("./navigation/studio-tabs").StudioTabs;
  let CreatePanel: typeof import("./create/create-panel").CreatePanel;
  let SpatialPanel: typeof import("./spatial/spatial-panel").SpatialPanel;
  let VerifyPanel: typeof import("./verify/verify-panel").VerifyPanel;

  beforeAll(async () => {
    AppUiProvider = (await import("@canva/app-ui-kit")).AppUiProvider;
    StudioTabs = (await import("./navigation/studio-tabs")).StudioTabs;
    CreatePanel = (await import("./create/create-panel")).CreatePanel;
    SpatialPanel = (await import("./spatial/spatial-panel")).SpatialPanel;
    VerifyPanel = (await import("./verify/verify-panel")).VerifyPanel;
  });

  const cache = createIntlCache();
  const intl = createIntl(
    { locale: "en", defaultLocale: "en", messages: {}, onError: () => {} },
    cache,
  );
  const wrap = (children: React.ReactNode) => (
    <AppUiProvider>
      <RawIntlProvider value={intl}>{children}</RawIntlProvider>
    </AppUiProvider>
  );

  it("renders compact Create Spatial Verify navigation", () => {
    const html = renderToString(wrap(<StudioTabs activeTab="create" onSelectTab={vi.fn()} />));
    expect(html).toContain("CREATE");
    expect(html).toContain("SPATIAL");
    expect(html).toContain("VERIFY");
  });

  it("renders the forgeable material studio in the narrow Create panel", () => {
    const html = renderToString(
      wrap(
        <CreatePanel onPreviewHologram={vi.fn()} onForgeIntoCanva={vi.fn()} isForging={false} />,
      ),
    );
    expect(html).toContain("01 · CREATION TYPE");
    expect(html).toContain("02 · MATERIAL");
    expect(html).toContain("Iridescent Chrome");
    expect(html).toContain("Preview Hologram");
    expect(html).toContain("Forge into Canva");
  });

  it("renders Spatial empty-state and Source/Holo comparison controls", () => {
    const html = renderToString(
      wrap(
        <SpatialPanel
          spatialModel={null}
          effectPlan={null}
          selectedElementId={null}
          onSelectElement={vi.fn()}
        />,
      ),
    );
    expect(html).toContain("2.5D SCENE PREVIEW");
    expect(html).toContain("Holo");
    expect(html).toContain("Source");
  });

  it("preserves the verified workflow in the Verify panel", () => {
    const html = renderToString(
      wrap(
        <VerifyPanel
          snapshot={null}
          reviewScenario={null}
          review={[]}
          scenarioVerified={false}
          readyToApply={false}
          isReading={false}
          isApplying={false}
          receipt={null}
          attestation={null}
          onRefresh={vi.fn()}
          onApply={vi.fn()}
        />,
      ),
    );
    expect(html).toContain("Capture state");
    expect(html).toContain("Waiting for a candidate");
  });
});
