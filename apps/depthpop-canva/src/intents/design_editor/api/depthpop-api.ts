import { DepthScene, isDepthScene } from "../scene/depth-scene";

export interface CreateSceneOptions {
  image: Blob | File;
  maxObjects?: number;
  segmentationMode?: string;
  depthQuality?: string;
  inpaint?: boolean;
}

export interface CreateSceneJobResponse {
  jobId: string;
  status: string;
}

export type JobProcessingStage =
  | "queued"
  | "decoding"
  | "segmenting_objects"
  | "estimating_depth"
  | "extracting_objects"
  | "reconstructing_plate"
  | "building_scene"
  | "complete"
  | "error";

export interface JobStatusResponse {
  jobId: string;
  status: string;
  stage: JobProcessingStage;
  progress?: number;
  sceneId?: string;
  error?: string;
}

export type DepthScenePatchPayload = Readonly<{
  objects: ReadonlyArray<
    Pick<
      DepthScene["objects"][number],
      "id" | "transform" | "opacity" | "feather" | "visible" | "locked" | "order"
    >
  >;
  camera: DepthScene["camera"];
  timeline: DepthScene["timeline"];
}>;

function scenePatchPayload(scene: DepthScene): DepthScenePatchPayload {
  return {
    objects: scene.objects.map((object) => ({
      id: object.id,
      transform: object.transform,
      opacity: object.opacity,
      feather: object.feather,
      visible: object.visible,
      locked: object.locked,
      order: object.order,
    })),
    camera: scene.camera,
    timeline: scene.timeline,
  };
}

async function apiError(response: Response, fallback: string): Promise<Error> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: unknown; error?: unknown; message?: unknown }
      | null;
    const detail = payload?.detail ?? payload?.error ?? payload?.message;
    if (typeof detail === "string" && detail.trim()) {
      return new Error(detail);
    }
  }

  const text = await response.text().catch(() => "");
  if (text.trim()) {
    return new Error(text.trim().slice(0, 500));
  }
  return new Error(`${fallback}: status ${response.status}`);
}

function assertPng(blob: Blob): void {
  if (blob.type && blob.type !== "image/png") {
    throw new Error("DepthPop compositor returned a non-PNG artifact.");
  }
  if (blob.size <= 0 || blob.size > 50 * 1024 * 1024) {
    throw new Error("DepthPop compositor returned an empty or oversized PNG.");
  }
}

export class DepthPopApiClient {
  private readonly apiOrigin: string;

  constructor(
    private readonly baseUrl: string,
    private readonly getAuthToken?: () => Promise<string | null>,
  ) {
    this.apiOrigin = new URL(baseUrl).origin;
  }

  private authenticatedAssetUrl(assetUrl: string): string {
    const resolved = new URL(assetUrl, this.baseUrl + "/");
    if (resolved.origin !== this.apiOrigin) {
      throw new Error(
        "DepthPop refused to send Canva authorization to a cross-origin scene asset.",
      );
    }
    return resolved.toString();
  }

  private async getHeaders(
    extraHeaders: Record<string, string> = {},
  ): Promise<HeadersInit> {
    const headers: Record<string, string> = { ...extraHeaders };
    if (this.getAuthToken) {
      const token = await this.getAuthToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }
    return headers;
  }

  async fetchAssetBlobUrl(
    assetUrl: string,
    signal?: AbortSignal,
  ): Promise<string> {
    if (assetUrl.startsWith("data:") || assetUrl.startsWith("blob:")) {
      return assetUrl;
    }

    const headers = await this.getHeaders();
    const authenticatedUrl = this.authenticatedAssetUrl(assetUrl);
    const res = await fetch(authenticatedUrl, {
      method: "GET",
      headers,
      signal,
    });
    if (!res.ok) {
      throw await apiError(res, "Failed to fetch scene asset");
    }

    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) {
      throw new Error("DepthPop scene asset returned a non-image payload.");
    }
    if (blob.size <= 0 || blob.size > 50 * 1024 * 1024) {
      throw new Error("DepthPop scene asset is empty or exceeds 50 MB.");
    }
    return URL.createObjectURL(blob);
  }

  async createSceneJob(
    options: CreateSceneOptions,
    signal?: AbortSignal,
  ): Promise<CreateSceneJobResponse> {
    const formData = new FormData();
    formData.append("image", options.image);
    formData.append("max_objects", String(options.maxObjects ?? 24));
    formData.append("segmentation_mode", options.segmentationMode ?? "auto");
    formData.append("depth_quality", options.depthQuality ?? "high");
    formData.append("inpaint", String(options.inpaint ?? false));

    const headers = await this.getHeaders();
    const res = await fetch(`${this.baseUrl}/api/v1/scenes`, {
      method: "POST",
      headers,
      body: formData,
      signal,
    });

    if (!res.ok) {
      throw await apiError(res, "Failed to create scene job");
    }

    return (await res.json()) as CreateSceneJobResponse;
  }

  async getJobStatus(
    jobId: string,
    signal?: AbortSignal,
  ): Promise<JobStatusResponse> {
    const headers = await this.getHeaders();
    const res = await fetch(
      `${this.baseUrl}/api/v1/jobs/${encodeURIComponent(jobId)}`,
      {
        method: "GET",
        headers,
        signal,
      },
    );

    if (!res.ok) {
      throw await apiError(res, "Failed to fetch job status");
    }

    return (await res.json()) as JobStatusResponse;
  }

  async getScene(sceneId: string, signal?: AbortSignal): Promise<DepthScene> {
    const headers = await this.getHeaders();
    const res = await fetch(
      `${this.baseUrl}/api/v1/scenes/${encodeURIComponent(sceneId)}`,
      {
        method: "GET",
        headers,
        signal,
      },
    );

    if (!res.ok) {
      throw await apiError(res, "Failed to fetch scene");
    }

    const payload: unknown = await res.json();
    if (!isDepthScene(payload)) {
      throw new Error("Invalid DepthScene payload returned from API.");
    }

    return payload;
  }

  async patchScene(
    sceneId: string,
    scene: DepthScene,
    signal?: AbortSignal,
  ): Promise<DepthScene> {
    const headers = await this.getHeaders({
      "Content-Type": "application/json",
    });
    const res = await fetch(
      `${this.baseUrl}/api/v1/scenes/${encodeURIComponent(sceneId)}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify(scenePatchPayload(scene)),
        signal,
      },
    );

    if (!res.ok) {
      throw await apiError(res, "Failed to save scene");
    }

    const payload: unknown = await res.json();
    if (!isDepthScene(payload)) {
      throw new Error("Invalid DepthScene payload returned from PATCH.");
    }
    return payload;
  }

  async createSceneComposite(
    sceneId: string,
    signal?: AbortSignal,
  ): Promise<Blob> {
    const headers = await this.getHeaders();
    const res = await fetch(
      `${this.baseUrl}/api/v1/scenes/${encodeURIComponent(sceneId)}/composite`,
      {
        method: "POST",
        headers,
        signal,
      },
    );

    if (!res.ok) {
      throw await apiError(res, "Failed to render scene composite");
    }

    const blob = await res.blob();
    assertPng(blob);
    return blob;
  }
}

export { scenePatchPayload };
