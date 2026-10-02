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

export class DepthPopApiClient {
  private objectUrls: string[] = [];

  constructor(
    private readonly baseUrl: string,
    private readonly getAuthToken?: () => Promise<string | null>,
  ) {}

  private async getHeaders(
    extraHeaders: Record<string, string> = {},
  ): Promise<HeadersInit> {
    const headers: Record<string, string> = { ...extraHeaders };
    if (this.getAuthToken) {
      const token = await this.getAuthToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }
    return headers;
  }

  async fetchAssetBlobUrl(assetUrl: string): Promise<string> {
    if (assetUrl.startsWith("data:") || assetUrl.startsWith("blob:")) {
      return assetUrl;
    }

    const headers = await this.getHeaders();
    const res = await fetch(assetUrl, { method: "GET", headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch scene asset: status ${res.status}`);
    }

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    this.objectUrls.push(blobUrl);
    return blobUrl;
  }

  revokeObjectUrls(): void {
    for (const url of this.objectUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    this.objectUrls = [];
  }

  async createSceneJob(
    options: CreateSceneOptions,
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
    });

    if (!res.ok) {
      throw new Error(`Failed to create scene job: status ${res.status}`);
    }

    return (await res.json()) as CreateSceneJobResponse;
  }

  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const headers = await this.getHeaders();
    const res = await fetch(
      `${this.baseUrl}/api/v1/jobs/${encodeURIComponent(jobId)}`,
      {
        method: "GET",
        headers,
      },
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch job status: status ${res.status}`);
    }

    return (await res.json()) as JobStatusResponse;
  }

  async getScene(sceneId: string): Promise<DepthScene> {
    const headers = await this.getHeaders();
    const res = await fetch(
      `${this.baseUrl}/api/v1/scenes/${encodeURIComponent(sceneId)}`,
      {
        method: "GET",
        headers,
      },
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch scene: status ${res.status}`);
    }

    const payload: unknown = await res.json();
    if (!isDepthScene(payload)) {
      throw new Error("Invalid DepthScene payload returned from API");
    }

    return payload;
  }

  async patchScene(
    sceneId: string,
    payload: Partial<DepthScene>,
  ): Promise<DepthScene> {
    const headers = await this.getHeaders({
      "Content-Type": "application/json",
    });
    const res = await fetch(
      `${this.baseUrl}/api/v1/scenes/${encodeURIComponent(sceneId)}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      throw new Error(`Failed to patch scene: status ${res.status}`);
    }

    const resData: unknown = await res.json();
    if (!isDepthScene(resData)) {
      throw new Error("Invalid DepthScene payload returned from PATCH");
    }

    return resData;
  }

  async createSceneComposite(
    sceneId: string,
  ): Promise<{ ok: boolean; url: string; mimeType: string; sceneId: string }> {
    const headers = await this.getHeaders();
    const res = await fetch(
      `${this.baseUrl}/api/v1/scenes/${encodeURIComponent(sceneId)}/composite`,
      {
        method: "POST",
        headers,
      },
    );

    if (!res.ok) {
      throw new Error(`Failed to create scene composite: status ${res.status}`);
    }

    return (await res.json()) as {
      ok: boolean;
      url: string;
      mimeType: string;
      sceneId: string;
    };
  }
}
