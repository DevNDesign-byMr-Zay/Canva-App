import React from "react";
import { renderToString } from "react-dom/server";
import { createIntl, createIntlCache, RawIntlProvider } from "react-intl";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@canva/design", () => ({
  initAppElement: () => ({ addElement: vi.fn(async () => undefined) }),
}));

vi.mock("@canva/app-ui-kit", async () => {
  const ReactModule = await import("react");
  const element = (
    tag: string,
    displayName: string,
  ): React.FC<React.PropsWithChildren<Record<string, unknown>>> => {
    const Component: React.FC<React.PropsWithChildren<Record<string, unknown>>> = ({
      children,
      ...props
    }) =>
      ReactModule.createElement(
        tag,
        Object.fromEntries(
          Object.entries(props).filter(
            ([key]) =>
              !["variant", "tone", "stretch", "loading"].includes(key) &&
              !key.startsWith("on"),
          ),
        ),
        children,
      );
    Component.displayName = displayName;
    return Component;
  };

  return {
    Alert: element("div", "Alert"),
    Button: element("button", "Button"),
    Rows: element("div", "Rows"),
    Text: element("span", "Text"),
    Title: element("h3", "Title"),
  };
});

describe("HoloForge studio sidebar components", () => {
  let StudioTabs: typeof import("./navigation/studio-tabs").StudioTabs;
  let CreationTypes: typeof import("./create/creation-types").CreationTypes;
  let MaterialPresets: typeof import("./create/material-presets").MaterialPresets;
  let MaterialControls: typeof import("./create/material-controls").MaterialControls;
  let CreatePanel: typeof import("./create/create-panel").CreatePanel;
  let SpatialPreviewView: typeof import("./spatial/spatial-preview-view").SpatialPreviewView;
  let SpatialPanel: typeof import("./spatial/spatial-panel").SpatialPanel;
  let SnapshotCard: typeof import("./verify/snapshot-card").SnapshotCard;
  let ReviewCard: typeof import("./verify/review-card").ReviewCard;
  let VerifyPanel: typeof import("./verify/verify-panel").VerifyPanel;
  let MATERIAL_PRESETS: typeof import("./holographic/material-contract").MATERIAL_PRESETS;

  beforeAll(async () => {
    StudioTabs = (await import("./navigation/studio-tabs")).StudioTabs;
    CreationTypes = (await import("./create/creation-types")).CreationTypes;
    MaterialPresets = (await import("./create/material-presets")).MaterialPresets;
    MaterialControls = (await import("./create/material-controls")).MaterialControls;
    CreatePanel = (await import("./create/create-panel")).CreatePanel;
    SpatialPreviewView = (await import("./spatial/spatial-preview-view")).SpatialPreviewView;
    SpatialPanel = (await import("./spatial/spatial-panel")).SpatialPanel;
    SnapshotCard = (await import("./verify/snapshot-card")).SnapshotCard;
    ReviewCard = (await import("./verify/review-card")).ReviewCard;
    VerifyPanel = (await import("./verify/verify-panel")).VerifyPanel;
    MATERIAL_PRESETS = (await import("./holographic/material-contract")).MATERIAL_PRESETS;
  });

  const cache = createIntlCache();
  const intl = createIntl(
    { locale: "en", defaultLocale: "en", messages: {}, onError: () => {} },
    cache,
  );
  const wrap = (children: React.ReactNode) => (
    <RawIntlProvider value={intl}>{children}</RawIntlProvider>
  );

  it("renders compact Create Spatial Verify navigation", () => {
    const html = renderToString(
      wrap(<StudioTabs activeTab="create" onSelectTab={vi.fn()} />),
    );
    expect(html).toContain("CREATE");
    expect(html).toContain("SPATIAL");
    expect(html).toContain("VERIFY");
  });

  it("renders creation types and deterministic material presets", () => {
    const types = renderToString(
      wrap(<CreationTypes selectedType="holo_graphic" onSelectType={vi.fn()} />),
    );
    const presets = renderToString(
      wrap(
        <MaterialPresets
          selectedPresetId="iridescent-chrome"
          onSelectPreset={vi.fn()}
        />,
      ),
    );
    expect(types).toContain("Holo Graphic");
    expect(types).toContain("Chrome");
    expect(presets).toContain("Iridescent Chrome");
    expect(presets).toContain("Holo Gunmetal");
  });

  it("renders compact material controls", () => {
    const html = renderToString(
      wrap(
        <MaterialControls
          parameters={MATERIAL_PRESETS[0].parameters}
          onChangeParameter={vi.fn()}
        />,
      ),
    );
    expect(html).toContain("Color Shift");
    expect(html).toContain("Reflection");
    expect(html).toContain("Advanced Controls");
  });

  it("renders the forgeable material studio", () => {
    const html = renderToString(
      wrap(
        <CreatePanel
          onPreviewHologram={vi.fn()}
          onForgeIntoCanva={vi.fn()}
          isForging={false}
        />,
      ),
    );
    expect(html).toContain("01 · CREATION TYPE");
    expect(html).toContain("02 · MATERIAL");
    expect(html).toContain("Preview Hologram");
    expect(html).toContain("Forge into Canva");
  });

  it("renders Spatial empty-state and Source/Holo comparison controls", () => {
    const emptyPreview = renderToString(
      <SpatialPreviewView
        model={null}
        selectedElementId={null}
        onSelectElement={vi.fn()}
        viewMode="holo"
      />,
    );
    const panel = renderToString(
      wrap(
        <SpatialPanel
          spatialModel={null}
          effectPlan={null}
          selectedElementId={null}
          onSelectElement={vi.fn()}
        />,
      ),
    );
    expect(emptyPreview).toContain("No active spatial elements");
    expect(panel).toContain("2.5D SCENE PREVIEW");
    expect(panel).toContain("Holo");
    expect(panel).toContain("Source");
  });

  it("renders snapshot and waiting review states", () => {
    const snapshot = renderToString(
      wrap(
        <SnapshotCard
          snapshot={null}
          onRefresh={vi.fn()}
          isLoading={false}
          isApplying={false}
        />,
      ),
    );
    const review = renderToString(
      wrap(
        <ReviewCard
          reviewScenario={null}
          review={[]}
          hasSnapshot={false}
          scenarioVerified={false}
          readyToApply={false}
          isApplying={false}
          isReading={false}
          onApply={vi.fn()}
        />,
      ),
    );
    expect(snapshot).toContain("Capture state");
    expect(review).toContain("Waiting for a candidate");
  });

  it("composes the Verify panel without bypassing explicit Apply", () => {
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
