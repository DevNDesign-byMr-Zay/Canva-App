import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { DepthObject } from "../scene/depth-scene";
import {
  objectWorldPosition,
  sampledTransform,
  trackValue,
  worldTransformToDepthTransform,
} from "./scene-sampling";

function fixture(): DepthObject {
  return {
    id: "demo",
    label: "Demo",
    semanticType: "product",
    confidence: 1,
    bbox: { x: 0, y: 0, width: 50, height: 50 },
    assets: { cutoutUrl: "", maskUrl: "", thumbnailUrl: "" },
    depth: { min: 0, max: 1, mean: 0.5, median: 0.5 },
    transform: {
      position: { x: 0.5, y: 0.25, z: 0.4 },
      rotation: { x: 0, y: 10, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
    opacity: 0.8,
    feather: 0,
    visible: true,
    locked: false,
    order: 0,
    animationTracks: [
      {
        id: "move-x",
        property: "position.x",
        keyframes: [
          { timeMs: 0, value: 0.1, easing: "linear" },
          { timeMs: 1000, value: 0.9, easing: "linear" },
        ],
      },
    ],
  };
}

describe("DepthPop spatial transform sampling", () => {
  it("uses the fallback when no animation track exists", () => {
    expect(trackValue(fixture(), "opacity", 500, 0.8)).toBe(0.8);
  });

  it("interpolates animated object position without mutating its original transform", () => {
    const object = fixture();
    expect(sampledTransform(object, 0).position.x).toBeCloseTo(0.1);
    expect(sampledTransform(object, 500).position.x).toBeCloseTo(0.5);
    expect(sampledTransform(object, 1000).position.x).toBeCloseTo(0.9);
    expect(object.transform.position.x).toBe(0.5);
    expect(sampledTransform(object, 500).rotation.y).toBe(10);
  });

  it("converts normalized scene coordinates into world coordinates", () => {
    const pos = objectWorldPosition(fixture().transform, 2);
    expect(pos[0]).toBeCloseTo(0);
    expect(pos[1]).toBeCloseTo(1);
    expect(pos[2]).toBeCloseTo(0.4);
  });

  it("preserves translation, rotation and scale through the inverse transform", () => {
    const initial = fixture().transform;
    const group = new THREE.Group();
    group.position.set(...objectWorldPosition(initial, 2));
    group.rotation.set(0, THREE.MathUtils.degToRad(10), 0);
    group.scale.set(1, 1, 1);
    const result = worldTransformToDepthTransform(group, 200, 100);
    expect(result.position.x).toBeCloseTo(initial.position.x, 4);
    expect(result.position.y).toBeCloseTo(initial.position.y, 4);
    expect(result.position.z).toBeCloseTo(initial.position.z, 4);
    expect(result.rotation.y).toBeCloseTo(initial.rotation.y, 3);
    expect(result.scale.x).toBe(initial.scale.x);
  });
});
