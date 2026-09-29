import React from "react";
import { renderToString } from "react-dom/server";
import { createIntl, createIntlCache, RawIntlProvider } from "react-intl";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { CanvaDesignSnapshot } from "./canva-design";
import type { ApplyVerificationReceipt } from "./apply-verification";
import type { ApplyAttestation } from "./apply-attestation";
import type { HoloForgeScenario } from "./scenario-contract";
import type { ScenarioElementReview } from "./scenario-review";
import type { SpatialPreviewModel } from "./spatial-preview";

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

function elementChildren(node: React.ReactElement): React.ReactElement[] {
  const children = React.Children.toArray(
    (node.props as { children?: React.ReactNode }).children,
  );
  return children.filter(React.isValidElement) as React.ReactElement[];
}

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
  let ProofCard: typeof import("./verify/proof-card").ProofCard;
  let VerifyPanel: typeof import("./verify/verify-panel").VerifyPanel;
  let MATERIAL_PRESETS: typeof import("./holographic/material-contract").MATERIAL_PRESETS;
  let createEffectPlan: typeof import("./holographic/effect-plan").createEffectPlan;

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
    ProofCard = (await import("./verify/proof-card")).ProofCard;
    VerifyPanel = (await import("./verify/verify-panel")).VerifyPanel;
    MATERIAL_PRESETS = (await import("./holographic/material-contract")).MATERIAL_PRESETS;
    createEffectPlan = (await import("./holographic/effect-plan")).createEffectPlan;
  });

  const cache = createIntlCache();
  const intl = createIntl(
    { locale: "en", defaultLocale: "en", messages: {}, onError: () => {} },
    cache,
  );
  Object.defineProperty(intl, "formatMessage", {
    configurable: true,
    value: (
      descriptor: { defaultMessage?: unknown; id?: string },
      values?: Record<string, unknown>,
    ) => {
      let message = String(descriptor.defaultMessage ?? descriptor.id ?? "");
      if (values) {
        for (const [key, value] of Object.entries(values)) {
          message = message.replace(`{${key}}`, String(value));
        }
      }
      return message;
    },
  });

  const wrap = (children: React.ReactNode) => (
    <RawIntlProvider value={intl}>{children}</RawIntlProvider>
  );

  const fingerprint = "a".repeat(64);
  const snapshot: CanvaDesignSnapshot = {
    designTitle: "HoloForge Demo",
    designId: "design-1",
    pageId: "page-1",
    pageType: "absolute",
    pageDimensions: { width: 640, height: 360 },
    fingerprint,
    elements: [
      {
        id: "element-1",
        type: "shape",
        top: 20,
        left: 30,
        width: 180,
        height: 90,
        rotation: 0,
        locked: false,
      },
      {
        id: "element-2",
        type: "text",
        top: 140,
        left: 60,
        width: 220,
        height: 60,
        rotation: 0,
        locked: false,
      },
    ],
  };

  const scenario: HoloForgeScenario = {
    contractVersion: 1,
    scenarioId: "scenario-1",
    source: {
      designId: "design-1",
      snapshotId: "snapshot-1",
      pageIds: ["page-1"],
      snapshotFingerprint: fingerprint,
    },
    intent: {
      summary: "Improve holographic composition",
      objectiveId: "composition",
      objectiveDirection: "minimize",
    },
    constraints: { hard: [], soft: [] },
    candidate: {
      layout: { elements: { "element-1": { x: 42, y: 32 } } },
      changedElementIds: ["element-1"],
      delta: {},
    },
    evidence: {
      backend: "test",
      algorithm: "deterministic",
      seed: "1",
      status: "complete",
      objectiveScore: 1,
      baseline: { backend: "test", algorithm: "baseline", objectiveScore: 2 },
      objectiveGap: -1,
      durationMs: 1,
      hardConstraintsPassed: true,
      warnings: [],
    },
    interpretation: {
      producer: "test",
      label: "Holographic composition",
      summary: "Move one reviewed element.",
      tradeoffs: [],
    },
    presentation: { advisoryOnly: true, autoApply: false, target: "web-dashboard" },
    provenance: {
      scenarioFingerprint: "b".repeat(64),
      optimizationFingerprint: "c".repeat(64),
    },
  };

  const review: ScenarioElementReview[] = [
    {
      elementId: "element-1",
      before: { top: 20, left: 30, width: 180, height: 90, rotation: 0 },
      after: { top: 32, left: 42, width: 180, height: 90, rotation: 0 },
      changedFields: ["x", "y"],
    },
  ];

  const spatialModel: SpatialPreviewModel = {
    version: 1,
    interpretation: "read-only-spatial-preview",
    scenarioId: "scenario-1",
    sourceFingerprint: fingerprint,
    branches: { source: "reviewed-source", candidate: "advisory-candidate" },
    elements: [
      {
        elementId: "element-1",
        depth: 100,
        source: { x: 30, y: 20, width: 180, height: 90, rotation: 0 },
        candidate: { x: 42, y: 32, width: 180, height: 90, rotation: 0 },
        changed: true,
      },
      {
        elementId: "element-2",
        depth: 1,
        source: { x: 60, y: 140, width: 220, height: 60, rotation: 0 },
        candidate: { x: 60, y: 140, width: 220, height: 60, rotation: 0 },
        changed: false,
      },
    ],
    relationships: [
      {
        fromElementId: "element-1",
        toElementId: "element-2",
        kind: "review-sequence",
        advisoryOnly: true,
      },
    ],
    safety: { readOnly: true, autoApply: false, authoritative: false },
  };

  const receipt: ApplyVerificationReceipt = {
    version: 1,
    scenarioId: "scenario-1",
    scenarioFingerprint: "b".repeat(64),
    sourceFingerprint: fingerprint,
    expectedFingerprint: "d".repeat(64),
    resultingFingerprint: "d".repeat(64),
    changedElementIds: ["element-1"],
    verification: "post-apply-match",
    safety: {
      explicitUserApply: true,
      autoApply: false,
      authoritative: false,
      physicalActuation: false,
    },
    receiptFingerprint: "e".repeat(64),
  };

  const attestation: ApplyAttestation = {
    version: 1,
    scenarioId: "scenario-1",
    scenarioFingerprint: "b".repeat(64),
    receiptFingerprint: "e".repeat(64),
    designId: "design-1",
    pageId: "page-1",
    sourceFingerprint: fingerprint,
    resultingFingerprint: "d".repeat(64),
    changedElementIds: ["element-1"],
    verification: "reviewed-apply-attested",
    safety: {
      explicitUserApply: true,
      autoApply: false,
      authoritative: false,
      physicalActuation: false,
    },
    attestationFingerprint: "f".repeat(64),
  };

  it("renders every studio navigation state", () => {
    for (const activeTab of ["create", "spatial", "verify"] as const) {
      const html = renderToString(
        wrap(<StudioTabs activeTab={activeTab} onSelectTab={vi.fn()} />),
      );
      expect(html).toContain("CREATE");
      expect(html).toContain("SPATIAL");
      expect(html).toContain("VERIFY");
    }
  });

  it("routes StudioTabs callbacks", () => {
    const onSelectTab = vi.fn();
    const tree = StudioTabs({
      activeTab: "create",
      onSelectTab,
    }) as React.ReactElement;
    const list = elementChildren(tree)[0];
    for (const button of elementChildren(list)) {
      const props = button.props as { onClick?: () => void };
      props.onClick?.();
    }
    expect(onSelectTab).toHaveBeenCalledWith("create");
    expect(onSelectTab).toHaveBeenCalledWith("spatial");
    expect(onSelectTab).toHaveBeenCalledWith("verify");
  });

  it("renders and routes creation types and material presets", () => {
    const onSelectType = vi.fn();
    const typeTree = CreationTypes({
      selectedType: "holo_graphic",
      onSelectType,
    }) as React.ReactElement;
    const typeButtons = elementChildren(typeTree);
    (typeButtons[0].props as { onClick?: () => void }).onClick?.();
    (typeButtons[4].props as { onClick?: () => void }).onClick?.();
    expect(onSelectType).toHaveBeenCalledWith("holo_text");
    expect(onSelectType).toHaveBeenCalledWith("chrome");

    const onSelectPreset = vi.fn();
    const presetTree = MaterialPresets({
      selectedPresetId: "iridescent-chrome",
      onSelectPreset,
    }) as React.ReactElement;
    const presetButtons = elementChildren(presetTree);
    (presetButtons[0].props as { onClick?: () => void }).onClick?.();
    (presetButtons[8].props as { onClick?: () => void }).onClick?.();
    expect(onSelectPreset).toHaveBeenCalledTimes(2);
  });

  it("renders material controls and the forgeable Create panel", () => {
    const controls = renderToString(
      wrap(
        <MaterialControls
          parameters={MATERIAL_PRESETS[0].parameters}
          onChangeParameter={vi.fn()}
        />,
      ),
    );
    const create = renderToString(
      wrap(
        <CreatePanel
          onPreviewHologram={vi.fn()}
          onForgeIntoCanva={vi.fn()}
          isForging={false}
        />,
      ),
    );
    expect(controls).toContain("Color Shift");
    expect(controls).toContain("Reflection");
    expect(controls).toContain("Advanced Controls");
    expect(create).toContain("01 · CREATION TYPE");
    expect(create).toContain("02 · MATERIAL");
    expect(create).toContain("Forge into Canva");
  });

  it("renders non-empty spatial scene states", () => {
    const effectPlan = createEffectPlan({
      creationType: "chrome",
      presetId: "holo-gunmetal",
    });
    const onSelectElement = vi.fn();

    const sourceHtml = renderToString(
      <SpatialPreviewView
        model={spatialModel}
        selectedElementId="element-1"
        onSelectElement={onSelectElement}
        viewMode="source"
      />,
    );
    const holoHtml = renderToString(
      <SpatialPreviewView
        model={spatialModel}
        selectedElementId="element-2"
        onSelectElement={onSelectElement}
        viewMode="holo"
      />,
    );
    const panel = renderToString(
      wrap(
        <SpatialPanel
          spatialModel={spatialModel}
          effectPlan={effectPlan}
          selectedElementId="element-1"
          onSelectElement={onSelectElement}
        />,
      ),
    );

    expect(sourceHtml).toContain("element-1");
    expect(holoHtml).toContain("element-2");
    expect(panel).toContain("Holo Gunmetal");
    expect(panel).toContain("PRESENTATION Depth".replace("PRESENTATION ", "Presentation "));
  });

  it("routes spatial preview click and keyboard selection", () => {
    const onSelectElement = vi.fn();
    const tree = SpatialPreviewView({
      model: spatialModel,
      selectedElementId: "element-1",
      onSelectElement,
      viewMode: "holo",
    }) as React.ReactElement;
    const viewport = elementChildren(tree)[0];
    const layers = elementChildren(viewport);
    const firstProps = layers[0].props as {
      onClick?: () => void;
      onKeyDown?: (event: { key: string; preventDefault: () => void }) => void;
    };
    firstProps.onClick?.();
    firstProps.onKeyDown?.({ key: "Enter", preventDefault: vi.fn() });
    firstProps.onKeyDown?.({ key: "Escape", preventDefault: vi.fn() });
    expect(onSelectElement).toHaveBeenCalledWith("element-2");
  });

  it("renders snapshot, reviewed change, proof, and composed Verify states", () => {
    const snapshotHtml = renderToString(
      wrap(
        <SnapshotCard
          snapshot={snapshot}
          onRefresh={vi.fn()}
          isLoading={false}
          isApplying={false}
        />,
      ),
    );
    const reviewHtml = renderToString(
      wrap(
        <ReviewCard
          reviewScenario={scenario}
          review={review}
          hasSnapshot
          scenarioVerified
          readyToApply
          isApplying={false}
          isReading={false}
          onApply={vi.fn()}
        />,
      ),
    );
    const proofHtml = renderToString(
      wrap(<ProofCard receipt={receipt} attestation={attestation} />),
    );
    const verifyHtml = renderToString(
      wrap(
        <VerifyPanel
          snapshot={snapshot}
          reviewScenario={scenario}
          review={review}
          scenarioVerified
          readyToApply
          isReading={false}
          isApplying={false}
          receipt={receipt}
          attestation={attestation}
          onRefresh={vi.fn()}
          onApply={vi.fn()}
        />,
      ),
    );

    expect(snapshotHtml).toContain("2");
    expect(reviewHtml).toContain("element-1");
    expect(proofHtml).toContain("Apply proof sealed");
    expect(verifyHtml).toContain("Verified result");
  });

  it("renders empty verification states without enabling hidden writes", () => {
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
