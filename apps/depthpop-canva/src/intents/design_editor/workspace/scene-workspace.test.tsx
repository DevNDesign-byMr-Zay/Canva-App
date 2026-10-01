import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SceneWorkspace } from "./scene-workspace";
import { DepthScene } from "../scene/depth-scene";

const testScene: DepthScene = {
  schemaVersion: 1,
  id: "scene_test1",
  sourceAssetId: "asset_1",
  width: 200,
  height: 200,
  objects: [
    {
      id: "person_01",
      label: "person",
      semanticType: "person",
      confidence: 0.95,
      bbox: { x: 20, y: 20, width: 80, height: 80 },
      assets: {
        cutoutUrl: "http://test/cutout1.png",
        maskUrl: "http://test/mask1.png",
        thumbnailUrl: "http://test/thumb1.png",
      },
      depth: { mean: 0.8, median: 0.82, min: 0.7, max: 0.9 },
      transform: {
        position: { x: 0.3, y: 0.3, z: 0.5 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      opacity: 1,
      feather: 0,
      visible: true,
      locked: false,
      order: 1,
      animationTracks: [],
    },
    {
      id: "shoe_01",
      label: "shoe",
      semanticType: "product",
      confidence: 0.88,
      bbox: { x: 120, y: 120, width: 40, height: 40 },
      assets: {
        cutoutUrl: "http://test/cutout2.png",
        maskUrl: "http://test/mask2.png",
        thumbnailUrl: "http://test/thumb2.png",
      },
      depth: { mean: 0.3, median: 0.31, min: 0.2, max: 0.4 },
      transform: {
        position: { x: 0.7, y: 0.7, z: -0.5 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      opacity: 1,
      feather: 0,
      visible: true,
      locked: false,
      order: 0,
      animationTracks: [],
    },
  ],
  reconstructedPlate: {
    imageUrl: "http://test/plate.png",
    depthMapUrl: "http://test/depth.png",
  },
  camera: {
    position: { x: 0, y: 0, z: 5 },
    target: { x: 0, y: 0, z: 0 },
    fov: 50,
  },
  timeline: { durationMs: 0, fps: 30, currentTimeMs: 0 },
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
};

describe("SceneWorkspace UI", () => {
  it("renders reconstructed plate and object layers in HTML", () => {
    const html = renderToString(<SceneWorkspace initialScene={testScene} />);

    expect(html).toContain("DEPTHSCENE V1");
    expect(html).toContain("SCENE OBJECTS");
    expect(html).toContain("person_01");
    expect(html).toContain("shoe_01");
    expect(html).toContain("http://test/plate.png");
    expect(html).toContain("http://test/cutout1.png");
    expect(html).toContain("http://test/cutout2.png");
  });

  it("includes object inspector controls for active object", () => {
    const html = renderToString(<SceneWorkspace initialScene={testScene} />);

    expect(html).toContain("Z / Depth Offset");
    expect(html).toContain("Scale");
    expect(html).toContain("Rotation");
    expect(html).toContain("Opacity");
    expect(html).toContain("Feather Edge");
  });

  it("renders export button when onExport handler is provided", () => {
    const onExport = vi.fn();
    const html = renderToString(
      <SceneWorkspace initialScene={testScene} onExport={onExport} />,
    );

    expect(html).toContain("EXPORT DEPTHSCENE TO CANVA");
  });
});
