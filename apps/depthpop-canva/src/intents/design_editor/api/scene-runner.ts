import type {
  CreateSceneOptions,
  DepthPopApiClient,
  JobProcessingStage,
} from "./depthpop-api";
import type { DepthScene } from "../scene/depth-scene";

export interface SceneRunProgress {
  stage: JobProcessingStage;
  percent: number;
}

export interface SceneRunOptions {
  pollIntervalMs?: number;
  maxPollAttempts?: number;
  onProgress?: (progress: SceneRunProgress) => void;
  delay?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
}

export function abortableDelay(
  milliseconds: number,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function createDepthSceneFromImage(
  client: DepthPopApiClient,
  createOptions: CreateSceneOptions,
  signal: AbortSignal,
  options: SceneRunOptions = {},
): Promise<DepthScene> {
  const pollIntervalMs = Math.max(25, options.pollIntervalMs ?? 500);
  const maxPollAttempts = Math.max(1, options.maxPollAttempts ?? 180);
  const delay = options.delay ?? abortableDelay;

  const created = await client.createSceneJob(createOptions, signal);
  options.onProgress?.({ stage: "queued", percent: 10 });

  for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
    await delay(pollIntervalMs, signal);
    const job = await client.getJobStatus(created.jobId, signal);

    options.onProgress?.({
      stage: job.stage,
      percent:
        typeof job.progress === "number"
          ? Math.max(0, Math.min(100, Math.round(job.progress * 100)))
          : 10,
    });

    if (job.status === "error") {
      throw new Error(job.error || "Scene decomposition pipeline failed.");
    }

    if (job.status === "complete") {
      if (!job.sceneId) {
        throw new Error(
          "DepthPop reported a completed job without a scene identifier.",
        );
      }
      return await client.getScene(job.sceneId, signal);
    }
  }

  throw new Error(
    "DepthScene creation exceeded the client wait window. The provider job may still be running; retry when the provider is responsive.",
  );
}
