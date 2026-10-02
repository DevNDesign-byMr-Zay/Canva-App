import { afterEach, describe, expect, it, vi } from "vitest";
import { DepthScene } from "../scene/depth-scene";
import {
  DepthPopApiClient,
  scenePatchPayload,
} from "./depthpop-api";

function validScene(): DepthScene {
  return {
    schemaVersion: 1,
    id: "scene_456",
    sourceAssetId: "asset_789",
    width: 100,
    height: 100,
    objects: [
      {
        id: "person_01",
        label: "Person",
        semanticType: "person",
        confidence: 0.98,
        bbox: { x: 20, y: 20, width: 30, height: 40 },
        assets: {
          cutoutUrl: "https://api.test/api/v1/assets/cutout",
          maskUrl: "https://api.test/api/v1/assets/mask",
          thumbnailUrl: "https://api.test/api/v1/assets/thumb",
        },
        depth: { mean: 0.8, median: 0.82, min: 0.7, max: 0.9 },
        transform: {
          position: { x: 0.35, y: 0.4, z: 1.2 },
          rotation: { x: 0, y: 0, z: 8 },
          scale: { x: 1.1, y: 1.1, z: 1 },
        },
        opacity: 0.9,
        feather: 2,
        visible: true,
        locked: false,
        order: 0,
        animationTracks: [],
      },
    ],
    reconstructedPlate: {
      imageUrl: "https://api.test/api/v1/assets/plate",
      depthMapUrl: "https://api.test/api/v1/assets/depth",
    },
    camera: {
      position: { x: 0, y: 0, z: 5 },
      target: { x: 0, y: 0, z: 0 },
      fov: 50,
    },
    timeline: { durationMs: 1000, fps: 30, currentTimeMs: 250 },
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:01Z",
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DepthPopApiClient", () => {
  it("sends the authenticated object-scene create request", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ jobId: "job_test123", status: "queued" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const client = new DepthPopApiClient(
      "https://api.test",
      async () => "test-token",
    );
    const signal = new AbortController().signal;
    const result = await client.createSceneJob(
      { image: new Blob(["test"], { type: "image/png" }), inpaint: false },
      signal,
    );

    expect(result.jobId).toBe("job_test123");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/api/v1/scenes",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
        signal,
      }),
    );
    const request = mockFetch.mock.calls[0]?.[1] as RequestInit;
    const form = request.body as FormData;
    expect(form.get("inpaint")).toBe("false");
    expect(form.get("segmentation_mode")).toBe("auto");
  });

  it("passes AbortSignal through polling and scene retrieval", async () => {
    const scene = validScene();
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jobId: "job_test123",
            status: "complete",
            stage: "complete",
            sceneId: scene.id,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(scene), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", mockFetch);

    const client = new DepthPopApiClient("https://api.test");
    const signal = new AbortController().signal;
    const job = await client.getJobStatus("job_test123", signal);
    const loaded = await client.getScene(job.sceneId!, signal);

    expect(loaded.id).toBe(scene.id);
    expect(mockFetch.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ signal }),
    );
    expect(mockFetch.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ signal }),
    );
  });

  it("sends only editable scene fields to PATCH", async () => {
    const scene = validScene();
    const payload = scenePatchPayload(scene);

    expect(payload.objects[0]).toEqual({
      id: "person_01",
      transform: scene.objects[0]!.transform,
      opacity: 0.9,
      feather: 2,
      visible: true,
      locked: false,
      order: 0,
    });
    expect(JSON.stringify(payload)).not.toContain("sourceAssetId");
    expect(JSON.stringify(payload)).not.toContain("cutoutUrl");
    expect(JSON.stringify(payload)).not.toContain("confidence");

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(scene), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const client = new DepthPopApiClient(
      "https://api.test",
      async () => "test-token",
    );
    await client.patchScene(scene.id, scene);

    const init = mockFetch.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual(payload);
  });

  it("returns the authenticated raw composite PNG as a Blob", async () => {
    const png = new Blob(["png-data"], { type: "image/png" });
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(png, {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const client = new DepthPopApiClient(
      "https://api.test",
      async () => "test-token",
    );
    const result = await client.createSceneComposite("scene_456");

    expect(result.type).toBe("image/png");
    expect(result.size).toBeGreaterThan(0);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/api/v1/scenes/scene_456/composite",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
      }),
    );
  });

  it("loads protected scene assets through authenticated fetch", async () => {
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:depthpop-test");
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(new Blob(["image"], { type: "image/png" }), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const client = new DepthPopApiClient(
      "https://api.test",
      async () => "test-token",
    );
    const result = await client.fetchAssetBlobUrl(
      "https://api.test/api/v1/assets/abc",
    );

    expect(result).toBe("blob:depthpop-test");
    expect(createObjectURL).toHaveBeenCalledOnce();
  });


  it("rejects cross-origin protected assets before sending Canva authorization", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const client = new DepthPopApiClient(
      "https://api.test",
      async () => "test-token",
    );

    await expect(
      client.fetchAssetBlobUrl("https://evil.example/assets/abc"),
    ).rejects.toThrow(/cross-origin/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("resolves relative protected asset paths against the configured backend", async () => {
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:depthpop-relative");
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(new Blob(["image"], { type: "image/png" }), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const client = new DepthPopApiClient(
      "https://api.test/base",
      async () => "test-token",
    );
    const result = await client.fetchAssetBlobUrl("/api/v1/assets/abc");

    expect(result).toBe("blob:depthpop-relative");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/api/v1/assets/abc",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer test-token" },
      }),
    );
    createObjectURL.mockRestore();
  });

  it("surfaces backend detail messages instead of hiding provider errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "SAM provider unavailable" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const client = new DepthPopApiClient("https://api.test");
    await expect(client.getJobStatus("job_bad")).rejects.toThrow(
      "SAM provider unavailable",
    );
  });
});
