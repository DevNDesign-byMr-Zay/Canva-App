import React, { useEffect, useMemo, useRef, useState } from "react";
import { getTemporaryUrl, type ImageRef, upload } from "@canva/asset";
import { useSelection } from "@canva/app-hooks";
import { addElementAtPoint } from "@canva/design";
import { auth } from "@canva/user";

import {
  DEFAULT_DEPTHPOP_SETTINGS,
  buildDepthPopFormFields,
  type DepthPopSettings,
} from "../../depthpop/depthpop-model";

import { DepthPopApiClient, JobProcessingStage } from "./api/depthpop-api";
import { createDepthSceneFromImage } from "./api/scene-runner";
import {
  LocalImageUpload,
  type UploadedImageResult,
} from "./local-image-upload";
import { DepthScene } from "./scene/depth-scene";
import { SceneWorkspace } from "./workspace/scene-workspace";

import "./app.css";

declare const BACKEND_HOST: string;

type RunStage = "idle" | "reading" | JobProcessingStage;
type SourceKind = "canva" | "local";

const MAX_CANVA_RENDER_BYTES = 20 * 1024 * 1024;
const BACKGROUND_RECONSTRUCTION_ENABLED = true;

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
      <path d="M7 7h10v10H7V7Z" fill="none" stroke="#FFFFFF" strokeWidth="1.6" opacity=".35" />
      <path d="M5 9h10v10H5V9Z" fill="none" stroke="#FFFFFF" strokeWidth="1.6" opacity=".6" />
      <path d="M9 5h10v10H9V5Z" fill="none" stroke="#FFFFFF" strokeWidth="1.6" />
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
      return "READING SOURCE…";
    case "queued":
      return "QUEUED IN PIPELINE…";
    case "decoding":
      return "DECODING IMAGE…";
    case "segmenting_objects":
      return "SEGMENTING OBJECTS…";
    case "estimating_depth":
      return "ESTIMATING DEPTH…";
    case "extracting_objects":
      return "EXTRACTING CUTOUTS…";
    case "reconstructing_plate":
      return "RECONSTRUCTING PLATE…";
    case "building_scene":
      return "BUILDING DEPTHSCENE…";
    case "complete":
      return "SCENE READY";
    case "error":
      return "SCENE FAILED";
    default:
      return "PROCESSING DEPTHSCENE…";
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

function blobToDataUrl(blob: Blob): Promise<string> {
  if (
    blob.type !== "image/png" ||
    blob.size <= 0 ||
    blob.size > MAX_CANVA_RENDER_BYTES
  ) {
    throw new Error(
      "DepthPop's rendered PNG is empty, invalid, or exceeds the 20 MB Canva insertion limit.",
    );
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("DepthPop could not prepare the rendered PNG for Canva."));
    reader.onload = () => {
      if (
        typeof reader.result !== "string" ||
        !reader.result.startsWith("data:image/png")
      ) {
        reject(new Error("DepthPop compositor did not resolve to a PNG data URL."));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(
  source: UploadedImageResult,
  signal: AbortSignal,
): Promise<Blob> {
  const response = await fetch(source.dataUrl, { signal });
  if (!response.ok) {
    throw new Error("The uploaded local source could not be read.");
  }
  return await response.blob();
}

function isAbortError(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === "AbortError";
}

export function App() {
  const selectedImages = useSelection("image");
  const [settings] = useState<DepthPopSettings>(DEFAULT_DEPTHPOP_SETTINGS);
  const [stage, setStage] = useState<RunStage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeScene, setActiveScene] = useState<DepthScene | null>(null);
  const [localSource, setLocalSource] = useState<UploadedImageResult | null>(null);
  const [activeSourceRef, setActiveSourceRef] = useState<ImageRef | null>(null);
  const [activeSourceKind, setActiveSourceKind] = useState<SourceKind | null>(null);

  const runController = useRef<AbortController | null>(null);
  const exportController = useRef<AbortController | null>(null);
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
  const hasSource = Boolean(localSource) || selectedImages.count === 1;
  const canExecute = hasSource && Boolean(host) && !isBusy;

  const apiClient = useMemo(() => {
    if (!host) return null;
    return new DepthPopApiClient(host, () => auth.getCanvaUserToken());
  }, [host]);

  useEffect(
    () => () => {
      runController.current?.abort();
      exportController.current?.abort();
    },
    [],
  );

  // Legacy compatibility path remains available in the backend and is kept
  // here as a contract marker for the historical Drive v115 runtime. The
  // primary product path below is the object-aware DepthScene API.
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
  void executeLegacyDepthPop;

  const executeScenePipeline = async () => {
    if (!canExecute || !apiClient) return;

    runController.current?.abort();
    const controller = new AbortController();
    runController.current = controller;

    setError(null);
    setStage("reading");
    setProgress(5);

    try {
      let sourceBlob: Blob;
      let sourceRef: ImageRef;
      let sourceKind: SourceKind;

      if (localSource) {
        sourceBlob = await dataUrlToBlob(localSource, controller.signal);
        sourceRef = localSource.ref;
        sourceKind = "local";
      } else {
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
          signal: controller.signal,
        });
        if (!sourceResponse.ok) {
          throw new Error("Canva's temporary source image could not be downloaded.");
        }

        sourceBlob = await sourceResponse.blob();
        sourceRef = content.ref;
        sourceKind = "canva";
      }

      ensureSupportedInput(sourceBlob);
      if (sourceBlob.size <= 0 || sourceBlob.size > 50 * 1024 * 1024) {
        throw new Error("Selected image exceeds the 50 MB processing limit or is empty.");
      }

      setActiveSourceRef(sourceRef);
      setActiveSourceKind(sourceKind);
      setStage("queued");
      setProgress(10);

      const scene = await createDepthSceneFromImage(
        apiClient,
        {
          image: sourceBlob,
          maxObjects: 24,
          segmentationMode: "auto",
          depthQuality: "high",
          // Until the provider lane advertises a verified production
          // background-reconstruction provider, the client stays truthful.
          inpaint: BACKGROUND_RECONSTRUCTION_ENABLED,
        },
        controller.signal,
        {
          pollIntervalMs: 500,
          maxPollAttempts: 180,
          onProgress: ({ stage: nextStage, percent }) => {
            setStage(nextStage);
            setProgress(percent);
          },
        },
      );
      setActiveScene(scene);
      setStage("complete");
      setProgress(100);
    } catch (cause) {
      if (isAbortError(cause)) {
        return;
      }
      setProgress(0);
      setStage("error");
      setError(
        cause instanceof Error
          ? cause.message
          : "DepthPop could not process the selected image.",
      );
    } finally {
      if (runController.current === controller) {
        runController.current = null;
      }
    }
  };

  const handleSaveScene = async (sceneToSave: DepthScene): Promise<DepthScene> => {
    if (!apiClient) throw new Error("DepthPop backend is not configured.");
    const updated = await apiClient.patchScene(sceneToSave.id, sceneToSave);
    setActiveScene(updated);
    return updated;
  };

  const handleExportScene = async (sceneToExport: DepthScene) => {
    if (!apiClient) throw new Error("DepthPop backend is not configured.");

    exportController.current?.abort();
    const controller = new AbortController();
    exportController.current = controller;

    try {
      const saved = await apiClient.patchScene(
        sceneToExport.id,
        sceneToExport,
        controller.signal,
      );
      setActiveScene(saved);

      const compositeBlob = await apiClient.createSceneComposite(
        saved.id,
        controller.signal,
      );
      const dataUrl = await blobToDataUrl(compositeBlob);

      let replacedSelection = false;
      let renderedRef: ImageRef | null = null;

      if (activeSourceKind === "canva" && activeSourceRef) {
        const draft = await selectedImages.read();
        const content = draft.contents[0];
        if (content && content.ref === activeSourceRef) {
          const asset = await upload({
            type: "image",
            name: "DepthPop Scene",
            url: dataUrl,
            thumbnailUrl: dataUrl,
            mimeType: "image/png",
            parentRef: content.ref,
            aiDisclosure: "app_generated",
          });
          await asset.whenUploaded();
          content.ref = asset.ref;
          await draft.save();
          renderedRef = asset.ref;
          replacedSelection = true;
        }
      }

      if (!replacedSelection) {
        const asset = await upload({
          type: "image",
          name: "DepthPop Scene",
          url: dataUrl,
          thumbnailUrl: dataUrl,
          mimeType: "image/png",
          ...(activeSourceRef ? { parentRef: activeSourceRef } : {}),
          aiDisclosure: "app_generated",
        });
        await asset.whenUploaded();
        renderedRef = asset.ref;
        await addElementAtPoint({
          type: "image",
          ref: renderedRef,
          altText: {
            text: "DepthPop rendered scene",
            decorative: false,
          },
        });
      }

      setActiveScene(null);
      setStage("idle");
      setProgress(0);
      setError(null);
    } catch (cause) {
      if (isAbortError(cause)) return;
      const message =
        cause instanceof Error
          ? cause.message
          : "Failed to render the DepthScene into Canva.";
      setError(message);
      throw new Error(message);
    } finally {
      if (exportController.current === controller) {
        exportController.current = null;
      }
    }
  };

  const reset = () => {
    runController.current?.abort();
    exportController.current?.abort();
    runController.current = null;
    exportController.current = null;
    setStage("idle");
    setProgress(0);
    setError(null);
    setActiveScene(null);
    setActiveSourceRef(null);
    setActiveSourceKind(null);
    setLocalSource(null);
  };

  if (activeScene) {
    return (
      <main className="dp-app">
        <section className="dp-panel">
          <SceneWorkspace
            initialScene={activeScene}
            apiClient={apiClient}
            onExit={() => setActiveScene(null)}
            onSave={handleSaveScene}
            onExport={handleExportScene}
            backgroundReconstructionEnabled={BACKGROUND_RECONSTRUCTION_ENABLED}
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
            aria-label={isBusy ? "Cancel current DepthPop run and reset" : "Reset DepthPop"}
          >
            {isBusy ? "×" : "↺"}
          </button>
          <div className="dp-icon-wrap">
            <DepthPopLogo />
          </div>
          <span className="dp-canva-pill">CANVA</span>
        </header>

        <h1 id="depthpop-title">DEPTHPOP</h1>
        <div className="dp-chip">OBJECT-SCENE V1</div>
        <p className="dp-desc">
          Decompose a raster into editable depth-aware objects, tune the
          composition, then render the authored scene back into Canva.
        </p>

        <LocalImageUpload productName="DepthPop"
          classPrefix="dp"
          sourceLabel="LOCAL SOURCE"
          insertIntoDesign={false}
          onUploaded={(result) => {
            setLocalSource(result);
            setError(null);
          }}
        />

        <div className={"dp-source " + (hasSource ? "is-ready" : "")}>
          <span className="dp-source-dot" />
          <div>
            <span>{localSource ? "ACTIVE LOCAL SOURCE" : "CANVA SOURCE"}</span>
            <strong>
              {localSource
                ? localSource.fileName
                : selectedImages.count === 1
                  ? "1 raster image selected"
                  : selectedImages.count > 1
                    ? "Select one image only"
                    : "Select an image in Canva or upload one above"}
            </strong>
          </div>
          {localSource && (
            <button
              type="button"
              className="dp-btn-text"
              onClick={() => setLocalSource(null)}
            >
              USE CANVA SELECTION
            </button>
          )}
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
          The object-scene path does not silently fall back to the legacy flat
          DepthPop render. Provider failures remain visible so the scene stays
          truthful.
        </p>
      </section>
    </main>
  );
}
