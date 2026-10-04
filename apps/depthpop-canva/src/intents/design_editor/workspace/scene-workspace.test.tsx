// @vitest-environment jsdom

import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DepthScene } from "../scene/depth-scene";
import { SceneWorkspace } from "./scene-workspace";

afterEach(() => cleanup());

const pixel =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFgwJ/lbRScAAAAABJRU5ErkJggg==";

function scene(overrides: Partial<DepthScene> = {}): DepthScene {
  return {
    schemaVersion: 1,
    id: "scene-ui",
    sourceAssetId: "source-ui",
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
        id: "person_01",
        label: "Person",
        semanticType: "person",
        extractionQuality: "mask",
        confidence: 0.98,
        bbox: { x: 20, y: 20, width: 30, height: 40 },
        assets: {
          cutoutUrl: pixel,
          maskUrl: pixel,
          thumbnailUrl: pixel,
        },
        depth: { mean: 0.8, median: 0.82, min: 0.7, max: 0.9 },
        transform: {
          position: { x: 0.35, y: 0.4, z: 1.2 },
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
      imageUrl: pixel,
      depthMapUrl: pixel,
    },
    camera: {
      position: { x: 0, y: 0, z: 5 },
      target: { x: 0, y: 0, z: 0 },
      fov: 50,
    },
    timeline: { durationMs: 1000, fps: 30, currentTimeMs: 0 },
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

describe("SceneWorkspace interactions", () => {
  it("edits X and camera FOV, then saves the authored scene", async () => {
    const onSave = vi.fn(async (value: DepthScene) => ({
      ...value,
      updatedAt: "2026-10-01T00:01:00Z",
    }));

    render(<SceneWorkspace initialScene={scene()} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("X position"), {
      target: { value: "0.72" },
    });
    fireEvent.change(screen.getByLabelText("Field of view"), {
      target: { value: "68" },
    });
    fireEvent.click(screen.getByRole("button", { name: "SAVE SCENE" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const saved = onSave.mock.calls[0]![0];
    expect(saved.objects[0]!.transform.position).toEqual({
      x: 0.72,
      y: 0.4,
      z: 1.2,
    });
    expect(saved.camera.fov).toBe(68);
    expect(
      (screen.getByRole("button", { name: "SAVED" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("prevents transform editing while an object is locked", async () => {
    const onSave = vi.fn(async (value: DepthScene) => ({
      ...value,
      updatedAt: "2026-10-01T00:02:00Z",
    }));

    render(<SceneWorkspace initialScene={scene()} onSave={onSave} />);

    fireEvent.click(screen.getByTitle("Lock object"));
    fireEvent.change(screen.getByLabelText("X position"), {
      target: { value: "0.91" },
    });
    fireEvent.click(screen.getByRole("button", { name: "SAVE SCENE" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const saved = onSave.mock.calls[0]![0];
    expect(saved.objects[0]!.locked).toBe(true);
    expect(saved.objects[0]!.transform.position.x).toBe(0.35);
  });

  it("surfaces degraded bounding-box extraction instead of hiding it", () => {
    const degraded = scene({
      objects: [
        {
          ...scene().objects[0]!,
          extractionQuality: "bbox_fallback",
        },
      ],
    });

    render(<SceneWorkspace initialScene={degraded} />);

    expect(
      screen.getByText(/bounding-box fallback extraction/i),
    ).toBeTruthy();
    expect(screen.getByText(/BBOX FALLBACK/i)).toBeTruthy();
  });

  it("passes the current edited scene into render-to-Canva", async () => {
    const onExport = vi.fn(async (_value: DepthScene) => undefined);

    render(<SceneWorkspace initialScene={scene()} onExport={onExport} />);

    fireEvent.change(screen.getByLabelText("Object opacity"), {
      target: { value: "0.45" },
    });
    fireEvent.click(screen.getByRole("button", { name: "RENDER TO CANVA" }));

    await waitFor(() => expect(onExport).toHaveBeenCalledOnce());
    expect(onExport.mock.calls[0]![0].objects[0]!.opacity).toBe(0.45);
  });
});
