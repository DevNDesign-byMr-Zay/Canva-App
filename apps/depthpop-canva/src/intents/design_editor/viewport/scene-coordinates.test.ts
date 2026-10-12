import { describe, expect, it } from "vitest";

import type { DepthObject, DepthScene } from "../scene/depth-scene";
import {
  bboxToWorldSize,
  depthObjectToWorld,
  sceneWorldSize,
  worldTransformToDepthObject,
} from "./scene-coordinates";

function scene(width = 800, height = 400): DepthScene {
  return {
    schemaVersion: 1,
    id: "scene-coordinates",
    sourceAssetId: "asset-source",
    width,
    height,
    settings: {
      depthStrength: 0.32,
      depthBlur: 35,
      depthFidelity: 0.95,
      renderQuality: "cinematic",
      numInferenceSteps: 34,
    },
    objects: [],
    reconstructedPlate: {
      imageUrl: "/api/v1/assets/plate",
      depthMapUrl: "/api/v1/assets/depth",
    },
    camera: {
      position: { x: 0, y: 0, z: 5 },
      target: { x: 0, y: 0, z: 0 },
      fov: 50,
    },
    timeline: { durationMs: 2000, fps: 30, currentTimeMs: 0 },
    createdAt: "2026-10-04T00:00:00Z",
    updatedAt: "2026-10-04T00:00:00Z",
  };
}

function object(): DepthObject {
  return {
    id: "person-1",
    label: "person",
    semanticType: "person",
    confidence: 0.99,
    bbox: { x: 100, y: 100, width: 200, height: 100 },
    assets: {
      cutoutUrl: "/api/v1/assets/cutout",
      maskUrl: "/api/v1/assets/mask",
      thumbnailUrl: "/api/v1/assets/thumb",
    },
    depth: { mean: 0.8, median: 0.8, min: 0.7, max: 0.9 },
    transform: {
      position: { x: 0.25, y: 0.75, z: 1.2 },
      rotation: { x: 0, y: 45, z: 90 },
      scale: { x: 1.25, y: 0.8, z: 1 },
    },
    opacity: 1,
    feather: 0,
    visible: true,
    locked: false,
    order: 0,
    animationTracks: [],
  };
}

describe("DepthScene WebGL coordinate adapter", () => {
  it("preserves source aspect ratio in deterministic world dimensions", () => {
    expect(sceneWorldSize(scene(800, 400))).toEqual({
      width: 4.8,
      height: 2.4,
    });
    expect(sceneWorldSize(scene(400, 800))).toEqual({
      width: 1.2,
      height: 2.4,
    });
  });

  it("maps normalized image coordinates into centered WebGL coordinates", () => {
    const world = depthObjectToWorld(object(), scene());

    expect(world.position.x).toBeCloseTo(-1.2);
    expect(world.position.y).toBeCloseTo(-0.6);
    expect(world.position.z).toBeCloseTo(0.6);
    expect(world.rotation.y).toBeCloseTo(Math.PI / 4);
    expect(world.rotation.z).toBeCloseTo(Math.PI / 2);
    expect(world.scale).toEqual({ x: 1.25, y: 0.8, z: 1 });
  });

  it("maps object bounding boxes to world plane dimensions", () => {
    expect(bboxToWorldSize(object().bbox, scene())).toEqual({
      width: 1.2,
      height: 0.6,
    });
  });

  it("round-trips gizmo world transforms back to canonical normalized storage", () => {
    const source = object();
    const sceneSpec = scene();
    const world = depthObjectToWorld(source, sceneSpec);
    const roundTripped = worldTransformToDepthObject(
      {
        ...world,
        position: { x: 0.48, y: 0.24, z: -0.25 },
        rotation: { x: Math.PI / 6, y: -Math.PI / 4, z: Math.PI },
        scale: { x: 1.1, y: 1.2, z: 0.9 },
      },
      source,
      sceneSpec,
    );

    expect(roundTripped.position.x).toBeCloseTo(0.6);
    expect(roundTripped.position.y).toBeCloseTo(0.4);
    expect(roundTripped.position.z).toBeCloseTo(-0.5);
    expect(roundTripped.rotation.x).toBeCloseTo(30);
    expect(roundTripped.rotation.y).toBeCloseTo(-45);
    expect(roundTripped.rotation.z).toBeCloseTo(180);
    expect(roundTripped.scale).toEqual({ x: 1.1, y: 1.2, z: 0.9 });
  });

  it("does not add measured provider depth a second time", () => {
    const shallow = object();
    shallow.depth.median = 0.05;
    const deep = object();
    deep.depth.median = 0.95;

    expect(depthObjectToWorld(shallow, scene()).position.z).toBeCloseTo(0.6);
    expect(depthObjectToWorld(deep, scene()).position.z).toBeCloseTo(0.6);
  });
});
