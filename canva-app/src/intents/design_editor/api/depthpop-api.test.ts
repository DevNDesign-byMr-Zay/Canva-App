import { describe, expect, it, vi } from "vitest";
import { DepthPopApiClient } from "./depthpop-api";
import { DepthScene } from "../scene/depth-scene";

describe("DepthPopApiClient", () => {
  it("sends createSceneJob request correctly", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jobId: "job_test123", status: "queued" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new DepthPopApiClient("https://api.test", async () => "test-token");
    const dummyBlob = new Blob(["test"], { type: "image/png" });

    const res = await client.createSceneJob({ image: dummyBlob });

    expect(res.jobId).toBe("job_test123");
    expect(res.status).toBe("queued");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/api/v1/scenes",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
      }),
    );

    vi.unstubAllGlobals();
  });

  it("fetches job status correctly", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        jobId: "job_test123",
        status: "complete",
        stage: "complete",
        sceneId: "scene_456",
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new DepthPopApiClient("https://api.test");
    const res = await client.getJobStatus("job_test123");

    expect(res.jobId).toBe("job_test123");
    expect(res.status).toBe("complete");
    expect(res.sceneId).toBe("scene_456");

    vi.unstubAllGlobals();
  });

  it("fetches scene correctly", async () => {
    const validScene: DepthScene = {
      schemaVersion: 1,
      id: "scene_456",
      sourceAssetId: "asset_789",
      width: 100,
      height: 100,
      objects: [],
      reconstructedPlate: { imageUrl: "http://img", depthMapUrl: "http://depth" },
      camera: { position: { x: 0, y: 0, z: 5 }, target: { x: 0, y: 0, z: 0 }, fov: 50 },
      timeline: { durationMs: 0, fps: 30, currentTimeMs: 0 },
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => validScene,
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new DepthPopApiClient("https://api.test");
    const scene = await client.getScene("scene_456");

    expect(scene.id).toBe("scene_456");
    expect(scene.schemaVersion).toBe(1);

    vi.unstubAllGlobals();
  });
});
