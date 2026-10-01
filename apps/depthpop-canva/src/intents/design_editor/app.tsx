import React, { useMemo, useState } from "react";
import { getTemporaryUrl, upload } from "@canva/asset";
import { useSelection } from "@canva/app-hooks";
import { auth } from "@canva/user";

import {
  DEFAULT_DEPTHPOP_SETTINGS,
  buildDepthPopFormFields,
  normalizeDepthPopSettings,
  type DepthPopSettings,
} from "../../depthpop/depthpop-model";

import { DepthPopApiClient, JobProcessingStage } from "./api/depthpop-api";
import { DepthScene } from "./scene/depth-scene";
import { SceneWorkspace } from "./workspace/scene-workspace";
import { LocalImageUpload } from "./local-image-upload";

import "./app.css";

declare const BACKEND_HOST: string;

type RunStage = "idle" | "reading" | JobProcessingStage;

function backendOrigin(): string {
  if (typeof BACKEND_HOST !== "string") return "";
  return BACKEND_HOST.trim().replace(/\/+$/u, "");
}

function DepthPopLogo() {
  return (
    <svg
      className="dp-mark"
      viewBox="0 0 24 24"
      role="img"
      aria-label="DepthPop layered square depth emblem"
    >
      <path
        d="M7 7h10v10H7V7Z"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.6"
        opacity=".35"
      />
      <path
        d="M5 9h10v10H5V9Z"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.6"
        opacity=".6"
      />
      <path
        d="M9 5h10v10H9V5Z"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.6"
      />
      <path
        d="M14.5 10.5c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2Z"
        fill="#A855F7"
        opacity=".92"
      />
    </svg>
  );
}

function stageLabel(stage: RunStage): string {
  switch (stage) {
    case "reading":
      return "READING CANVA SOURCE...";
    case "queued":
      return "QUEUED IN PIPELINE...";
    case "decoding":
      return "DECODING IMAGE...";
    case "segmenting_objects":
      return "SEGMENTING INSTANCE OBJECTS...";
    case "estimating_depth":
      return "ESTIMATING DEPTH MAP...";
    case "extracting_objects":
      return "EXTRACTING CUTOUTS & MASKS...";
    case "reconstructing_plate":
      return "RECONSTRUCTING BACKGROUND PLATE...";
    case "building_scene":
      return "BUILDING DEPTHSCENE GRAPH...";
    case "complete":
      return "SCENE READY";
    default:
      return "PROCESSING DEPTHSCENE...";
  }
}

function ensureSupportedInput(blob: Blob): string {
  if (
    blob.type === "image/png" ||
    blob.type === "image/jpeg" ||
    blob.type === "image/webp"
  ) {
    return blob.type;
  }
  throw new Error("DepthPop supports PNG, JPEG, and WebP raster images.");
}

export function App() {
  const selectedImages = useSelection("image");
  const [settings, setSettings] = useState<DepthPopSettings>(
    DEFAULT_DEPTHPOP_SETTINGS,
  );
  const [stage, setStage] = useState<RunStage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeScene, setActiveScene] = useState<DepthScene | null>(null);

  const host = useMemo(backendOrigin, []);
  const isBusy = [
    "reading",
    "queued",
    "decoding",
    "segmenting_objects",
    "estimating_depth",
    "extracting_objects",
    "reconstructing_plate",
    "building_scene",
  ].includes(stage);
  const canExecute = selectedImages.count === 1 && Boolean(host) && !isBusy;

  const apiClient = useMemo(() => {
    if (!host) return null;
    return new DepthPopApiClient(host, () => auth.getCanvaUserToken());
  }, [host]);

  // Legacy fallback compatibility helper
  const executeLegacyDepthPop = async (sourceBlob: Blob, token: string) => {
    const fields = buildDepthPopFormFields(settings);
    const form = new FormData();
    form.append("image", sourceBlob);
    form.append("strength", fields.strength);
    form.append("bokeh", fields.bokeh);
    form.append("depth_fidelity", fields.depth_fidelity);
    form.append("num_inference_steps", fields.num_inference_steps);

    return fetch(host + "/api/depthpop", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: form,
    });
  };

  const executeScenePipeline = async () => {
    if (!canExecute || !apiClient) return;

    setError(null);
    setStage("reading");
    setProgress(5);

    try {
      const draft = await selectedImages.read();
      const content = draft.contents[0];
      if (!content) throw new Error("Select one raster image in Canva first.");

      const temporary = await getTemporaryUrl({
        type: "image",
        ref: content.ref,
      });
      const sourceResponse = await fetch(temporary.url, {
        mode: "cors",
        cache: "no-store",
      });
      if (!sourceResponse.ok) {
        throw new Error(
          "Canva temporary source image could not be downloaded.",
        );
      }

      const sourceBlob = await sourceResponse.blob();
      ensureSupportedInput(sourceBlob);

      if (sourceBlob.size <= 0 || sourceBlob.size > 50 * 1024 * 1024) {
        throw new Error("Selected image exceeds 50 MB limit or is empty.");
      }

      setStage("queued");
      setProgress(10);

      // 1. Create Scene Job
      const createResp = await apiClient.createSceneJob({
        image: sourceBlob,
        maxObjects: 24,
        segmentationMode: "auto",
        depthQuality: "high",
        inpaint: true,
      });

      const jobId = createResp.jobId;

      // 2. Poll Job Status
      let completedSceneId: string | null = null;
      for (let i = 0; i < 60; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const statusResp = await apiClient.getJobStatus(jobId);

        setStage(statusResp.stage);
        if (typeof statusResp.progress === "number") {
          setProgress(Math.round(statusResp.progress * 100));
        }

        if (statusResp.status === "complete" && statusResp.sceneId) {
          completedSceneId = statusResp.sceneId;
          break;
        }

        if (statusResp.status === "error") {
          throw new Error(
            statusResp.error || "Scene decomposition pipeline failed.",
          );
        }
      }

      if (!completedSceneId) {
        // Fallback to legacy single-image render if v1 pipeline falls back
        const token = await auth.getCanvaUserToken();
        const legacyResp = await executeLegacyDepthPop(sourceBlob, token);
        if (!legacyResp.ok) throw new Error("Scene creation timed out.");
        const legacyBody = await legacyResp.json();

        const asset = await upload({
          type: "image",
          url: legacyBody.url,
          thumbnailUrl: legacyBody.thumbnailUrl || legacyBody.url,
          mimeType: legacyBody.mimeType || "image/png",
          parentRef: content.ref,
          aiDisclosure: "app_generated",
        });
        await asset.whenUploaded();
        content.ref = asset.ref;
        await draft.save();
        setStage("complete");
        setProgress(100);
        return;
      }

      // 3. Fetch Canonical DepthScene
      const sceneData = await apiClient.getScene(completedSceneId);
      setActiveScene(sceneData);
      setStage("complete");
      setProgress(100);
    } catch (cause) {
      setProgress(0);
      setStage("error");
      setError(
        cause instanceof Error
          ? cause.message
          : "DepthPop could not process the selected image.",
      );
    }
  };

  const handleExportScene = async (sceneToExport: DepthScene) => {
    try {
      const draft = await selectedImages.read();
      const content = draft.contents[0];
      if (!content) return;

      const asset = await upload({
        type: "image",
        url: sceneToExport.reconstructedPlate.imageUrl,
        mimeType: "image/png",
        parentRef: content.ref,
        aiDisclosure: "app_generated",
      });
      await asset.whenUploaded();

      content.ref = asset.ref;
      await draft.save();
      setActiveScene(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to export scene to Canva",
      );
    }
  };

  const reset = () => {
    setSettings(DEFAULT_DEPTHPOP_SETTINGS);
    setStage("idle");
    setProgress(0);
    setError(null);
    setActiveScene(null);
  };

  if (activeScene) {
    return (
      <main className="dp-app">
        <section className="dp-panel">
          <SceneWorkspace
            initialScene={activeScene}
            onExit={() => setActiveScene(null)}
            onExport={handleExportScene}
          />
        </section>
      </main>
    );
  }

  return (
    <main className="dp-app">
      <section className="dp-panel" aria-labelledby="depthpop-title">
        <header className="dp-top">
          <button
            className="dp-reset"
            type="button"
            onClick={reset}
            disabled={isBusy}
            aria-label="Reset DepthPop controls"
          >
            ↺
          </button>
          <div className="dp-icon-wrap">
            <DepthPopLogo />
          </div>
          <span className="dp-canva-pill">CANVA</span>
        </header>

        <h1 id="depthpop-title">DEPTHPOP</h1>
        <div className="dp-chip">OBJECT-SCENE V1</div>
        <p className="dp-desc">
          Instance-object depth decomposition — individual 3D cutout layers and
          plate reconstruction.
        </p>

        <LocalImageUpload productName="DepthPop" classPrefix="dp" />

        <div
          className={
            "dp-source " + (selectedImages.count === 1 ? "is-ready" : "")
          }
        >
          <span className="dp-source-dot" />
          <div>
            <span>CANVA SOURCE</span>
            <strong>
              {selectedImages.count === 1
                ? "1 raster image selected"
                : selectedImages.count > 1
                  ? "Select one image only"
                  : "Select an image in Canva"}
            </strong>
          </div>
        </div>

        {isBusy && (
          <div className="dp-progress" aria-live="polite">
            <div className="dp-progress-track">
              <span style={{ width: progress + "%" }} />
            </div>
            <div className="dp-progress-copy">
              <span>{stageLabel(stage)}</span>
              <strong>{progress}%</strong>
            </div>
          </div>
        )}

        {error && <div className="dp-error">{error}</div>}
        {!host && (
          <div className="dp-error">
            Backend host is not configured for this build.
          </div>
        )}

        <button
          className="dp-exec"
          type="button"
          disabled={!canExecute}
          onClick={() => void executeScenePipeline()}
        >
          <span>{isBusy ? stageLabel(stage) : "CREATE DEPTHSCENE"}</span>
          <i aria-hidden="true" />
        </button>

        <p className="dp-note">
          Decomposes your image into individual object layers with measured 3D
          depth statistics.
        </p>
      </section>
    </main>
  );
}
