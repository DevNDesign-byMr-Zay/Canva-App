import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("./viewport/HoloViewport", () => ({
  HoloViewport: vi.fn(() => null),
}));

import { createEffectPlan } from "./holographic/effect-plan";
import type { HolographicExecutionResult } from "./holographic/effect-executor";
import { createHoloScene } from "./scene/holo-scene";
import { SpatialPreview, VerifyPanel } from "./studio-panels";
import { HoloViewport } from "./viewport/HoloViewport";

const plan = createEffectPlan({
  creationType: "holo_text",
  presetId: "prism-foil",
  sourceText: "Panel regression",
});

beforeEach(() => vi.clearAllMocks());

it("keeps the empty spatial state and does not mount a viewport", () => {
  const html = renderToStaticMarkup(
    <SpatialPreview plan={null} scene={null} onSceneChange={vi.fn()} />,
  );
  expect(html).toContain("No hologram staged yet");
  expect(html).toContain('class="hf-empty-state"');
  expect(HoloViewport).not.toHaveBeenCalled();
});

it("passes the same authored scene and callback through the spatial panel", () => {
  const scene = createHoloScene(plan);
  const onSceneChange = vi.fn();
  const before = JSON.stringify(scene);
  const html = renderToStaticMarkup(
    <SpatialPreview plan={plan} scene={scene} onSceneChange={onSceneChange} />,
  );
  const props = vi.mocked(HoloViewport).mock.calls.at(-1)![0];
  expect(props.scene).toBe(scene);
  expect(props.onSceneChange).toBe(onSceneChange);
  expect(JSON.stringify(scene)).toBe(before);
  expect(html).toContain(plan.presetName);
  expect(html).toContain("WEBGL · X/Y/Z + TIME");
  expect(html).toContain("Depth");
});

it("renders restored-scene material metrics without inventing a plan", () => {
  const scene = createHoloScene(plan);
  const object = scene.objects[0]!;
  const html = renderToStaticMarkup(
    <SpatialPreview plan={null} scene={scene} onSceneChange={vi.fn()} />,
  );
  expect(html).toContain(object.material.family.toUpperCase() + " · RESTORED");
  expect(html).toContain("Thickness");
  expect(html).toContain(object.geometry.thickness.toFixed(2));
  expect(html).toContain(object.material.emissionStrength.toFixed(2));
});

it("keeps the awaiting receipt distinct from an executed plan", () => {
  const html = renderToStaticMarkup(
    <VerifyPanel plan={plan} result={null} error={null} />,
  );
  expect(html).toContain("AWAITING FORGE");
  expect(html).toContain("NOT EXECUTED");
  expect(html).not.toContain("is-sealed");
});

it.each([
  ["DERIVED_IMAGE", "HOLOGRAPHIC IMAGE CREATED"],
  ["APP_OWNED_EFFECT", "CANVA ELEMENT CREATED"],
] as const)("preserves the %s output receipt", (route, heading) => {
  const result: HolographicExecutionResult = {
    route,
    creationType: plan.creationType,
    presetId: plan.presetId,
    previewOnlyProperties: ["orbit preview"],
  };
  const html = renderToStaticMarkup(
    <VerifyPanel plan={plan} result={result} error={null} />,
  );
  expect(html).toContain(heading);
  expect(html).toContain("is-sealed");
  expect(html).toContain("Preview-only behavior: orbit preview");
  expect(html).toContain(route);
});

it("renders invalid plans and escapes error text as text", () => {
  const html = renderToStaticMarkup(
    <VerifyPanel
      plan={{ ...plan, isValid: false }}
      result={null}
      error={'<script>alert("untrusted")</script>'}
    />,
  );
  expect(html).toContain("INVALID");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
});
