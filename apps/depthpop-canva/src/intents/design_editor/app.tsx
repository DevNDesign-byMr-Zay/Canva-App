import React, { useMemo, useState } from "react";
import { getTemporaryUrl, upload } from "@canva/asset";
import { useSelection } from "@canva/app-hooks";
import { auth } from "@canva/user";

import {
  DEFAULT_DEPTHPOP_SETTINGS,
  buildDepthPopPayload,
  normalizeDepthPopSettings,
  type DepthPopSettings,
} from "../../depthpop/depthpop-model";

import "./app.css";

declare const BACKEND_HOST: string;

type RunState = "idle" | "reading" | "processing" | "uploading" | "saving" | "done" | "error";

type BackendResponse = {
  ok: boolean;
  url: string;
  thumbnailUrl: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  depthMapUrl?: string | null;
  model?: string;
};

function backendOrigin(): string {
  if (typeof BACKEND_HOST !== "string") return "";
  return BACKEND_HOST.trim().replace(/\/+$/u, "");
}

function SliderControl({
  label,
  hint,
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="dp-control" title={hint}>
      <span className="dp-control-label">
        <span>{label}</span>
        <strong>{displayValue}</strong>
      </span>
      <input
        className="dp-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  );
}

function DepthPopMark() {
  return (
    <svg className="dp-mark" viewBox="0 0 58 58" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="dp-g" x1="8" y1="8" x2="50" y2="50">
          <stop stopColor="#ece8ff" />
          <stop offset=".42" stopColor="#b184ff" />
          <stop offset="1" stopColor="#7352ff" />
        </linearGradient>
      </defs>
      <rect x="16" y="16" width="28" height="28" rx="5" stroke="url(#dp-g)" opacity=".32" />
      <rect x="10" y="22" width="28" height="28" rx="5" stroke="url(#dp-g)" opacity=".58" />
      <rect x="22" y="10" width="28" height="28" rx="5" stroke="url(#dp-g)" strokeWidth="1.8" />
      <circle cx="36" cy="24" r="4.5" fill="url(#dp-g)" />
    </svg>
  );
}

function messageForState(state: RunState): string {
  if (state === "reading") return "Reading selected Canva image…";
  if (state === "processing") return "Building depth map + cinematic separation…";
  if (state === "uploading") return "Importing the DepthPop render into Canva…";
  if (state === "saving") return "Replacing the selected image…";
  if (state === "done") return "DepthPop complete. The selected Canva image was replaced.";
  return "";
}

export function App() {
  const selectedImages = useSelection("image");
  const [settings, setSettings] = useState<DepthPopSettings>(DEFAULT_DEPTHPOP_SETTINGS);
  const [state, setState] = useState<RunState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const host = useMemo(backendOrigin, []);
  const isBusy = ["reading", "processing", "uploading", "saving"].includes(state);
  const canExecute = selectedImages.count === 1 && Boolean(host) && !isBusy;

  const setSetting = (key: keyof DepthPopSettings, value: number) => {
    setSettings((current) => normalizeDepthPopSettings({ ...current, [key]: value }));
  };

  const execute = async () => {
    if (!canExecute) return;

    setError(null);
    setProgress(8);
    setState("reading");

    try {
      const draft = await selectedImages.read();
      const content = draft.contents[0];
      if (!content) throw new Error("Select one raster image in Canva before running DepthPop.");

      const temporary = await getTemporaryUrl({ type: "image", ref: content.ref });
      setProgress(24);
      setState("processing");

      const token = await auth.getCanvaUserToken();
      const response = await fetch(host + "/api/depthpop", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildDepthPopPayload(temporary.url, settings)),
      });

      const body = (await response.json().catch(() => null)) as BackendResponse | { detail?: string } | null;
      if (!response.ok || !body || !("url" in body) || !body.url) {
        const detail = body && "detail" in body ? body.detail : null;
        throw new Error(detail || "DepthPop backend did not return a usable image.");
      }

      if (!["image/png", "image/jpeg", "image/webp"].includes(body.mimeType)) {
        throw new Error("DepthPop backend returned an unsupported image type.");
      }

      setProgress(76);
      setState("uploading");
      const asset = await upload({
        type: "image",
        url: body.url,
        thumbnailUrl: body.thumbnailUrl || body.url,
        mimeType: body.mimeType,
        parentRef: content.ref,
        aiDisclosure: "none",
      });

      content.ref = asset.ref;
      setProgress(92);
      setState("saving");
      await draft.save();

      setProgress(100);
      setState("done");
    } catch (cause) {
      setProgress(0);
      setState("error");
      setError(cause instanceof Error ? cause.message : "DepthPop could not process the selected image.");
    }
  };

  const reset = () => {
    setSettings(DEFAULT_DEPTHPOP_SETTINGS);
    setState("idle");
    setProgress(0);
    setError(null);
  };

  return (
    <main className="dp-app">
      <section className="dp-panel" aria-labelledby="depthpop-title">
        <header className="dp-top">
          <button className="dp-reset" type="button" onClick={reset} disabled={isBusy} aria-label="Reset DepthPop controls">
            ↺
          </button>
          <div className="dp-icon-wrap"><DepthPopMark /></div>
          <span className="dp-canva-pill">CANVA</span>
        </header>

        <h1 id="depthpop-title">DEPTHPOP</h1>
        <div className="dp-chip">DEPTH POP</div>
        <p className="dp-desc">Turn depth into presence — subtle separation, cinematic focus, same scene.</p>

        <div className="dp-controls">
          <SliderControl
            label="Depth Strength (subject pop)"
            hint="How strong the depth separation feels."
            value={settings.depthStrength}
            min={0.05}
            max={0.75}
            step={0.01}
            displayValue={settings.depthStrength.toFixed(2)}
            onChange={(value) => setSetting("depthStrength", value)}
          />
          <SliderControl
            label="Depth Blur (background softness)"
            hint="Blurs background based on depth. 0% subtle, 100% dramatic."
            value={settings.depthBlur}
            min={0}
            max={100}
            step={1}
            displayValue={Math.round(settings.depthBlur) + "%"}
            onChange={(value) => setSetting("depthBlur", value)}
          />
          <SliderControl
            label="Depth Fidelity (depth-map accuracy)"
            hint="How tightly DepthPop follows the depth map. 0.25 is softer, 1.00 is locked in."
            value={settings.depthFidelity}
            min={0.05}
            max={1}
            step={0.01}
            displayValue={settings.depthFidelity.toFixed(2)}
            onChange={(value) => setSetting("depthFidelity", value)}
          />
          <SliderControl
            label="Steps (quality vs speed)"
            hint="Inference steps. Higher is cleaner but slower."
            value={settings.steps}
            min={8}
            max={50}
            step={1}
            displayValue={String(Math.round(settings.steps))}
            onChange={(value) => setSetting("steps", value)}
          />
        </div>

        <div className={"dp-source " + (selectedImages.count === 1 ? "is-ready" : "")}>
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

        {(isBusy || state === "done") && (
          <div className="dp-progress" aria-live="polite">
            <div className="dp-progress-track"><span style={{ width: progress + "%" }} /></div>
            <div className="dp-progress-copy"><span>{messageForState(state)}</span><strong>{progress}%</strong></div>
          </div>
        )}

        {error && <div className="dp-error">{error}</div>}
        {!host && <div className="dp-error">Backend host is not configured for this build.</div>}

        <button className="dp-exec" type="button" disabled={!canExecute} onClick={() => void execute()}>
          <span>{isBusy ? "PROCESSING DEPTHPOP" : "EXECUTE DEPTHPOP"}</span>
          <i aria-hidden="true" />
        </button>

        <p className="dp-note">
          Runs only on the image you selected. The original Canva asset remains the parent of the derived DepthPop asset.
        </p>
      </section>
    </main>
  );
}
