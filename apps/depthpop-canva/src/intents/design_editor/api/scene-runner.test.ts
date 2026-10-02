import { describe, expect, it, vi } from "vitest";

import type { DepthScene } from "../scene/depth-scene";
import type { DepthPopApiClient } from "./depthpop-api";
import {
  abortableDelay,
  createDepthSceneFromImage,
} from "./scene-runner";

function scene(): DepthScene {
  return {
    schemaVersion: 1,
    id: "scene_ready",
    sourceAssetId: "source",
    width: 10,
    height: 10,
    objects: [],
    reconstructedPlate: {
      imageUrl: "data:image/png;base64,AAAA",
      depthMapUrl: "data:image/png;base64,AAAA",
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
}

function fakeClient(overrides: Partial<DepthPopApiClient> = {}): DepthPopApiClient {
  return {
    createSceneJob: vi.fn(async () => ({
      jobId: "job_1",
      status: "queued",
    })),
    getJobStatus: vi.fn(async () => ({
      jobId: "job_1",
      status: "complete",
      stage: "complete",
      progress: 1,
      sceneId: "scene_ready",
    })),
    getScene: vi.fn(async () => scene()),
    ...overrides,
  } as unknown as DepthPopApiClient;
}

const immediateDelay = async (_ms: number, signal: AbortSignal) => {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
};

describe("createDepthSceneFromImage", () => {
  it("returns the completed scene and reports real job progress", async () => {
    const client = fakeClient();
    const progress: Array<{ stage: string; percent: number }> = [];
    const controller = new AbortController();

    const result = await createDepthSceneFromImage(
      client,
      { image: new Blob(["x"], { type: "image/png" }), inpaint: false },
      controller.signal,
      {
        delay: immediateDelay,
        onProgress: (value) => progress.push(value),
      },
    );

    expect(result.id).toBe("scene_ready");
    expect(progress).toEqual([
      { stage: "queued", percent: 10 },
      { stage: "complete", percent: 100 },
    ]);
    expect(client.getScene).toHaveBeenCalledWith(
      "scene_ready",
      controller.signal,
    );
  });

  it("surfaces provider job errors without a legacy fallback", async () => {
    const client = fakeClient({
      getJobStatus: vi.fn(async () => ({
        jobId: "job_1",
        status: "error",
        stage: "segmenting_objects",
        progress: 0.25,
        error: "SAM segmentation failed",
      })),
    });
    const controller = new AbortController();

    await expect(
      createDepthSceneFromImage(
        client,
        { image: new Blob(["x"], { type: "image/png" }) },
        controller.signal,
        { delay: immediateDelay },
      ),
    ).rejects.toThrow("SAM segmentation failed");

    expect(client.getScene).not.toHaveBeenCalled();
  });

  it("fails if a completed job omits its scene id", async () => {
    const client = fakeClient({
      getJobStatus: vi.fn(async () => ({
        jobId: "job_1",
        status: "complete",
        stage: "complete",
        progress: 1,
      })),
    });

    await expect(
      createDepthSceneFromImage(
        client,
        { image: new Blob(["x"], { type: "image/png" }) },
        new AbortController().signal,
        { delay: immediateDelay },
      ),
    ).rejects.toThrow(/without a scene identifier/i);
  });

  it("times out deterministically after the configured attempts", async () => {
    const client = fakeClient({
      getJobStatus: vi.fn(async () => ({
        jobId: "job_1",
        status: "processing",
        stage: "estimating_depth",
        progress: 0.5,
      })),
    });

    await expect(
      createDepthSceneFromImage(
        client,
        { image: new Blob(["x"], { type: "image/png" }) },
        new AbortController().signal,
        {
          delay: immediateDelay,
          maxPollAttempts: 3,
        },
      ),
    ).rejects.toThrow(/exceeded the client wait window/i);

    expect(client.getJobStatus).toHaveBeenCalledTimes(3);
  });

  it("honors cancellation before another poll can overwrite state", async () => {
    const controller = new AbortController();
    controller.abort();
    const client = fakeClient();

    await expect(
      createDepthSceneFromImage(
        client,
        { image: new Blob(["x"], { type: "image/png" }) },
        controller.signal,
        { delay: immediateDelay },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(client.getJobStatus).not.toHaveBeenCalled();
  });
});

describe("abortableDelay", () => {
  it("rejects promptly when its signal is aborted", async () => {
    const controller = new AbortController();
    const waiting = abortableDelay(10_000, controller.signal);
    controller.abort();

    await expect(waiting).rejects.toMatchObject({ name: "AbortError" });
  });
});
