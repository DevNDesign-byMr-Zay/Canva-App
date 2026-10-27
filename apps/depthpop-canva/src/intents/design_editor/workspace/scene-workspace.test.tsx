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

vi.mock("../viewport/DepthViewport", () => ({
  DepthViewport: ({
    scene,
    onUpdateTransform,
  }: {
    scene: DepthScene;
    onUpdateTransform?: (
      objectId: string,
      transform: DepthScene["objects"][number]["transform"],
    ) => void;
  }) => (
    <div data-testid="depth-webgl-viewport" data-scene-id={scene.id}>
      <button
        type="button"
        aria-label="Mock transform gizmo"
        onClick={() =>
          onUpdateTransform?.("person_01", {
            position: { x: 0.8, y: 0.4, z: 1.2 },
            rotation: { x: 0, y: 0, z: 12 },
            scale: { x: 1.1, y: 1.1, z: 1.1 },
          })
        }
      >
        GIZMO
      </button>
    </div>
  ),
}));

import { DepthPopApiClient } from "../api/depthpop-api";
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
  it("uses the WebGL viewport instead of the legacy CSS pseudo-3D stage", () => {
    render(<SceneWorkspace initialScene={scene()} />);

    expect(screen.getByTestId("depth-webgl-viewport")).toBeTruthy();
    expect(document.querySelector(".dp-stage-camera")).toBeNull();
    expect(document.querySelector(".dp-stage-object")).toBeNull();
  });

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

    expect(screen.getByText(/bounding-box fallback extraction/i)).toBeTruthy();
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

  it("authors a gizmo pose into typed keyframes and saves it", async () => {
    const onSave = vi.fn(async (value: DepthScene) => ({
      ...value,
      updatedAt: "2026-10-01T00:04:00Z",
    }));

    render(<SceneWorkspace initialScene={scene()} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "ANIMATE" }));
    fireEvent.change(screen.getByLabelText("Timeline time"), {
      target: { value: "500" },
    });
    fireEvent.click(screen.getByLabelText("Mock transform gizmo"));
    fireEvent.click(screen.getByRole("button", { name: "SAVE SCENE" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const saved = onSave.mock.calls[0]![0];
    const xTrack = saved.objects[0]!.animationTracks.find(
      (track) => track.property === "position.x",
    );
    expect(xTrack?.keyframes).toEqual([
      { timeMs: 0, value: 0.35, easing: "linear" },
      { timeMs: 500, value: 0.8, easing: "ease-in-out" },
    ]);
  });

  it("wires duplicate to the authenticated scene object API", async () => {
    const client = new DepthPopApiClient("https://api.test");
    const updated = scene({
      objects: [
        ...scene().objects,
        {
          ...scene().objects[0]!,
          id: "person_01_copy",
          label: "Person Copy",
          order: 1,
        },
      ],
      updatedAt: "2026-10-01T00:05:00Z",
    });
    vi.spyOn(client, "duplicateObject").mockResolvedValue(updated);

    render(<SceneWorkspace initialScene={scene()} apiClient={client} />);

    fireEvent.click(screen.getByRole("button", { name: "DUPLICATE" }));

    await waitFor(() => expect(screen.getByText("Person Copy")).toBeTruthy());
    expect(client.duplicateObject).toHaveBeenCalledWith(
      "scene-ui",
      "person_01",
    );
  });

  it("starts a durable export job and surfaces completion", async () => {
    const client = new DepthPopApiClient("https://api.test");
    vi.spyOn(client, "createExportJob").mockResolvedValue({
      jobId: "export-test",
      status: "queued",
    });
    vi.spyOn(client, "getExportStatus").mockResolvedValue({
      jobId: "export-test",
      format: "glb",
      status: "complete",
      stage: "complete",
      progress: 1,
      artifactId: "artifact-test",
      downloadUrl: "/api/v1/artifacts/artifact-test/download",
      error: null,
    });

    render(<SceneWorkspace initialScene={scene()} apiClient={client} />);

    fireEvent.click(screen.getByRole("button", { name: "EXPORT" }));
    fireEvent.click(screen.getByRole("button", { name: "START EXPORT" }));

    await waitFor(() => expect(screen.getByText("COMPLETE")).toBeTruthy());
    expect(client.createExportJob).toHaveBeenCalledWith(
      "scene-ui",
      expect.objectContaining({
        format: "glb",
        includeAnimation: true,
      }),
    );
  });

  it("persists dirty local edits before a server object mutation", async () => {
    const client = new DepthPopApiClient("https://api.test");
    const onSave = vi.fn(async (value: DepthScene) => ({
      ...value,
      updatedAt: "2026-10-01T00:06:00Z",
    }));
    const duplicated: DepthScene = {
      ...scene(),
      objects: [
        {
          ...scene().objects[0]!,
          transform: {
            ...scene().objects[0]!.transform,
            position: { x: 0.77, y: 0.4, z: 1.2 },
          },
        },
        {
          ...scene().objects[0]!,
          id: "person_01_copy",
          label: "Person Copy",
          order: 1,
        },
      ],
      updatedAt: "2026-10-01T00:07:00Z",
    };
    vi.spyOn(client, "duplicateObject").mockResolvedValue(duplicated);

    render(
      <SceneWorkspace
        initialScene={scene()}
        apiClient={client}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("X position"), {
      target: { value: "0.77" },
    });
    fireEvent.click(screen.getByRole("button", { name: "DUPLICATE" }));

    await waitFor(() => expect(client.duplicateObject).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0]![0].objects[0]!.transform.position.x).toBe(
      0.77,
    );
  });
});
