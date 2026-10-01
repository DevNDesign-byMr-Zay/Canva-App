import { auth } from "@canva/user";

import type { HoloScene } from "../scene/holo-scene";
import type {
  HoloExportFormat,
  HoloExportRequest,
} from "./export-contract";

declare const BACKEND_HOST: string;

export type ExportJobState =
  | "queued"
  | "validating"
  | "rendering"
  | "packaging"
  | "complete"
  | "error";

export type CreateExportResponse = Readonly<{
  jobId: string;
  exportId: string;
  status: ExportJobState;
}>;

export type ExportJobResponse = Readonly<{
  id: string;
  exportId: string;
  status: ExportJobState;
  stage: string;
  percent: number;
  message: string;
  error?: string | null;
}>;

export type ExportStatusResponse = Readonly<{
  exportId: string;
  status: ExportJobState;
  downloadUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  expiresAt?: string | null;
  error?: string | null;
}>;

const IMPLEMENTED_WORKER_FORMATS = new Set<HoloExportFormat>([
  "glb",
  "gltf",
  "webm-alpha",
  "mp4",
  "png-sequence",
  "lightfield-quilt",
]);

export function backendOrigin(): string {
  if (typeof BACKEND_HOST !== "string") return "";
  return BACKEND_HOST.trim().replace(/\/+$/u, "");
}

export function isWorkerExportImplemented(format: HoloExportFormat): boolean {
  return IMPLEMENTED_WORKER_FORMATS.has(format);
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  if (blob.size > 15 * 1024 * 1024) {
    throw new Error("HoloForge export source exceeds the 15 MB browser materialization limit.");
  }

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("HoloForge could not encode the source image for export."));
    reader.onload = () => {
      if (typeof reader.result !== "string" || !reader.result.startsWith("data:image/")) {
        reject(new Error("HoloForge export source did not resolve to an image data URL."));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
}

async function materializeSourceUrl(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  if (url.startsWith("data:image/")) return url;

  const response = await fetch(url, {
    mode: "cors",
    cache: "no-store",
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error("HoloForge could not materialize the Canva source for export.");
  }
  const blob = await response.blob();
  if (!["image/png", "image/jpeg", "image/webp"].includes(blob.type)) {
    throw new Error("HoloForge export source must resolve to PNG, JPEG, or WebP.");
  }
  return await blobToDataUrl(blob);
}

export async function prepareSceneForBackend(scene: HoloScene): Promise<HoloScene> {
  const urls = new Set<string>();
  if (scene.source.previewUrl) urls.add(scene.source.previewUrl);
  for (const object of scene.objects) {
    if (object.geometry.sourceUrl) urls.add(object.geometry.sourceUrl);
  }

  const replacements = new Map<string, string>();
  for (const url of urls) {
    replacements.set(url, (await materializeSourceUrl(url)) ?? url);
  }

  return Object.freeze({
    ...scene,
    source: Object.freeze({
      ...scene.source,
      previewUrl: scene.source.previewUrl
        ? replacements.get(scene.source.previewUrl)
        : undefined,
    }),
    objects: Object.freeze(
      scene.objects.map((object) =>
        Object.freeze({
          ...object,
          geometry: Object.freeze({
            ...object.geometry,
            sourceUrl: object.geometry.sourceUrl
              ? replacements.get(object.geometry.sourceUrl)
              : undefined,
          }),
        }),
      ),
    ),
  });
}

async function authorizedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const host = backendOrigin();
  if (!host) {
    throw new Error("HoloForge render backend is not configured.");
  }
  const token = await auth.getCanvaUserToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", "Bearer " + token);

  return await fetch(host + path, {
    ...init,
    headers,
    cache: "no-store",
  });
}

async function jsonOrError<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as
    | T
    | { detail?: string; error?: string }
    | null;
  if (!response.ok) {
    const detail =
      body && typeof body === "object"
        ? ("detail" in body ? body.detail : "error" in body ? body.error : null)
        : null;
    throw new Error(detail || "HoloForge render backend request failed.");
  }
  return body as T;
}

export async function createBackendExport(
  scene: HoloScene,
  request: HoloExportRequest,
): Promise<CreateExportResponse> {
  const portableScene = await prepareSceneForBackend(scene);
  const response = await authorizedFetch("/api/v1/exports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scene: portableScene,
      request,
    }),
  });
  return await jsonOrError<CreateExportResponse>(response);
}

export async function readExportJob(jobId: string): Promise<ExportJobResponse> {
  const response = await authorizedFetch(
    "/api/v1/jobs/" + encodeURIComponent(jobId),
  );
  return await jsonOrError<ExportJobResponse>(response);
}

export async function readExportStatus(
  exportId: string,
): Promise<ExportStatusResponse> {
  const response = await authorizedFetch(
    "/api/v1/exports/" + encodeURIComponent(exportId),
  );
  return await jsonOrError<ExportStatusResponse>(response);
}

export async function waitForExport(
  jobId: string,
  onProgress?: (job: ExportJobResponse) => void,
  timeoutMs = 12 * 60 * 1000,
): Promise<ExportJobResponse> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const job = await readExportJob(jobId);
    onProgress?.(job);
    if (job.status === "complete") return job;
    if (job.status === "error") {
      throw new Error(job.error || "HoloForge export failed.");
    }
    await new Promise((resolve) => window.setTimeout(resolve, 750));
  }
  throw new Error("HoloForge export timed out while waiting for the render worker.");
}

export async function downloadBackendExport(
  exportId: string,
): Promise<string> {
  const status = await readExportStatus(exportId);
  if (status.status !== "complete" || !status.downloadUrl) {
    throw new Error(status.error || "HoloForge export is not ready to download.");
  }

  const response = await authorizedFetch(status.downloadUrl);
  if (!response.ok) {
    throw new Error("HoloForge could not download the completed export.");
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error("HoloForge export artifact was empty.");

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = status.fileName || "holoforge-export";
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.append(anchor);

  try {
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return status.fileName || "holoforge-export";
}
