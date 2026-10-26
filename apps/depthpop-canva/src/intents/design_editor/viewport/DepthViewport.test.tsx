// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="r3f-canvas">{children}</div>
  ),
  useThree: () => ({
    camera: {
      position: {
        x: 0,
        y: 0,
        z: 5,
        set: vi.fn(),
      },
      lookAt: vi.fn(),
    },
    gl: {
      domElement: document.createElement("canvas"),
      outputColorSpace: "",
      setClearColor: vi.fn(),
    },
  }),
}));

vi.mock("@react-three/drei", () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
  TransformControls: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="transform-controls">{children}</div>
  ),
}));

import type { DepthScene } from "../scene/depth-scene";
import { DepthViewport } from "./DepthViewport";

afterEach(() => cleanup());

function scene(locked = false): DepthScene {
  return {
    schemaVersion: 1,
    id: "viewport-scene",
    sourceAssetId: "source",
    width: 100,
    height: 100,
    settings: {
      depthStrength: 0.32,
      depthBlur: 35,
      depthFidelity: 0.95,
      renderQuality: "cinematic",
      numInferenceSteps: 34,
    },
    objects: [
      {
        id: "hero",
        label: "Hero",
        semanticType: "person",
        confidence: 1,
        bbox: { x: 20, y: 20, width: 50, height: 60 },
        assets: {
          cutoutUrl: "",
          maskUrl: "",
          thumbnailUrl: "",
        },
        depth: { mean: 0.8, median: 0.8, min: 0.7, max: 0.9 },
        transform: {
          position: { x: 0.5, y: 0.5, z: 0.7 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        },
        opacity: 1,
        feather: 0,
        visible: true,
        locked,
        order: 0,
        animationTracks: [],
      },
    ],
    reconstructedPlate: {
      imageUrl: "",
      depthMapUrl: "",
    },
    camera: {
      position: { x: 0, y: 0, z: 5 },
      target: { x: 0, y: 0, z: 0 },
      fov: 50,
    },
    timeline: {
      durationMs: 1000,
      fps: 30,
      currentTimeMs: 0,
    },
    createdAt: "2026-10-12T00:00:00Z",
    updatedAt: "2026-10-12T00:00:00Z",
  };
}

describe("DepthViewport production controls", () => {
  it("mounts the R3F canvas, orbit controls and selected transform gizmo", () => {
    render(
      <DepthViewport
        scene={scene()}
        selectedObjectId="hero"
        transformMode="translate"
      />,
    );

    expect(screen.getByTestId("r3f-canvas")).toBeTruthy();
    expect(screen.getByTestId("orbit-controls")).toBeTruthy();
    expect(screen.getByTestId("transform-controls")).toBeTruthy();
  });

  it("does not expose a transform gizmo for locked objects", () => {
    render(
      <DepthViewport
        scene={scene(true)}
        selectedObjectId="hero"
        transformMode="translate"
      />,
    );

    expect(screen.queryByTestId("transform-controls")).toBeNull();
    expect(screen.getByTestId("orbit-controls")).toBeTruthy();
  });
});
