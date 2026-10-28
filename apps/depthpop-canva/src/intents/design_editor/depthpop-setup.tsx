import React from "react";
import type { DepthPopSettings } from "../../depthpop/depthpop-model";
import type { JobProcessingStage } from "./api/depthpop-api";
import { LocalImageUpload, type UploadedImageResult } from "./local-image-upload";

export type RunStage = "idle" | "reading" | JobProcessingStage;

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

type DepthPopSetupProps = Readonly<{
  settings: DepthPopSettings;
  setSettings: React.Dispatch<React.SetStateAction<DepthPopSettings>>;
  isBusy: boolean;
  reset: () => void;
  localSource: UploadedImageResult | null;
  setLocalSource: React.Dispatch<React.SetStateAction<UploadedImageResult | null>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  hasSource: boolean;
  selectedImageCount: number;
  progress: number;
  stage: RunStage;
  error: string | null;
  host: string;
  canExecute: boolean;
  executeScenePipeline: () => Promise<void>;
}>;

export function DepthPopSetup({
  settings,
  setSettings,
  isBusy,
  reset,
  localSource,
  setLocalSource,
  setError,
  hasSource,
  selectedImageCount,
  progress,
  stage,
  error,
  host,
  canExecute,
  executeScenePipeline,
}: DepthPopSetupProps) {
  return (
    <main className="dp-app">
      <section className="dp-panel" aria-labelledby="depthpop-title">
        <header className="dp-top">
          <button
            className="dp-reset"
            type="button"
            onClick={reset}
            aria-label={
              isBusy
                ? "Cancel current DepthPop run and reset"
                : "Reset DepthPop"
            }
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

        <div className="dp-controls" aria-label="DepthPop controls">
          <label className="dp-control">
            <span className="dp-control-label">
              <span>Depth Strength (subject pop)</span>
              <strong>{settings.depthStrength.toFixed(2)}</strong>
            </span>
            <input
              className="dp-range"
              aria-label="Depth Strength"
              type="range"
              min={0.05}
              max={0.75}
              step={0.01}
              value={settings.depthStrength}
              onChange={(event) => {
                const depthStrength = Number(event.currentTarget.value);
                setSettings((current) => ({
                  ...current,
                  depthStrength,
                }));
              }}
            />
          </label>
          <label className="dp-control">
            <span className="dp-control-label">
              <span>Depth Blur (background softness)</span>
              <strong>{Math.round(settings.depthBlur)}%</strong>
            </span>
            <input
              className="dp-range"
              aria-label="Depth Blur"
              type="range"
              min={0}
              max={100}
              step={1}
              value={settings.depthBlur}
              onChange={(event) => {
                const depthBlur = Number(event.currentTarget.value);
                setSettings((current) => ({
                  ...current,
                  depthBlur,
                }));
              }}
            />
          </label>
          <label className="dp-control">
            <span className="dp-control-label">
              <span>Depth Fidelity (depth-map accuracy)</span>
              <strong>{settings.depthFidelity.toFixed(2)}</strong>
            </span>
            <input
              className="dp-range"
              aria-label="Depth Fidelity"
              type="range"
              min={0.05}
              max={1}
              step={0.01}
              value={settings.depthFidelity}
              onChange={(event) => {
                const depthFidelity = Number(event.currentTarget.value);
                setSettings((current) => ({
                  ...current,
                  depthFidelity,
                }));
              }}
            />
          </label>
          <div className="dp-control">
            <span className="dp-control-label">
              <span>Render Quality</span>
              <strong>{settings.renderQuality.toUpperCase()}</strong>
            </span>
            <div
              className="dp-quality-row"
              role="group"
              aria-label="Render Quality"
            >
              {(["fast", "balanced", "cinematic"] as const).map((quality) => (
                <button
                  key={quality}
                  type="button"
                  className={
                    settings.renderQuality === quality ? "is-active" : ""
                  }
                  aria-pressed={settings.renderQuality === quality}
                  onClick={() =>
                    setSettings((current) => ({
                      ...current,
                      renderQuality: quality,
                    }))
                  }
                >
                  {quality === "fast"
                    ? "Fast"
                    : quality === "balanced"
                      ? "Balanced"
                      : "Cinematic"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <LocalImageUpload
          productName="DepthPop"
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
                : selectedImageCount === 1
                  ? "1 raster image selected"
                  : selectedImageCount > 1
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
