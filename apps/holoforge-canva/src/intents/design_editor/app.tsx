import React, { useState } from "react";

import { CreatePanel } from "./create/create-panel";
import { canvaAppOwnedEffectAdapter } from "./holographic/app-owned-effect-adapter";
import { canvaDerivedImageAdapter } from "./holographic/derived-image-adapter";
import {
  executeHolographicEffectPlan,
  type HolographicExecutionResult,
} from "./holographic/effect-executor";
import type { HolographicEffectPlan } from "./holographic/effect-plan";
import { LocalImageUpload, type UploadedImageResult } from "./local-image-upload";
import { useCanvaImageSelection } from "./use-canva-image-selection";

import "./app.css";

type StudioTab = "create" | "spatial" | "verify";
type SourceMode = "selected" | "uploaded";

function HoloForgeLogo() {
  return (
    <svg className="hf-logo-mark" viewBox="0 0 512 512" role="img" aria-label="HoloForge holographic prism emblem">
      <defs>
        <linearGradient id="hf-ring" x1="70" y1="70" x2="442" y2="442" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#19F2FF" />
          <stop offset=".38" stopColor="#2787FF" />
          <stop offset=".68" stopColor="#7A55FF" />
          <stop offset="1" stopColor="#FF4FD8" />
        </linearGradient>
        <linearGradient id="hf-prism" x1="150" y1="88" x2="365" y2="390" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#49F6FF" />
          <stop offset=".35" stopColor="#18A7FF" />
          <stop offset=".64" stopColor="#7D55FF" />
          <stop offset="1" stopColor="#FF48D0" />
        </linearGradient>
        <linearGradient id="hf-metal" x1="160" y1="190" x2="352" y2="376" gradientUnits="userSpaceOnUse">
          <stop stopColor="#243554" />
          <stop offset=".28" stopColor="#09101E" />
          <stop offset=".55" stopColor="#374866" />
          <stop offset=".75" stopColor="#090D18" />
          <stop offset="1" stopColor="#16203A" />
        </linearGradient>
        <linearGradient id="hf-glass" x1="188" y1="108" x2="322" y2="270" gradientUnits="userSpaceOnUse">
          <stop stopColor="#DFFFFF" stopOpacity=".9" />
          <stop offset=".28" stopColor="#25E6FF" stopOpacity=".75" />
          <stop offset=".62" stopColor="#6A62FF" stopOpacity=".62" />
          <stop offset="1" stopColor="#FF62DA" stopOpacity=".82" />
        </linearGradient>
      </defs>
      <circle cx="256" cy="256" r="205" fill="none" stroke="#07111F" strokeWidth="28" opacity=".95" />
      <circle cx="256" cy="256" r="205" fill="none" stroke="url(#hf-ring)" strokeWidth="13" />
      <circle cx="256" cy="256" r="186" fill="none" stroke="#7BEFFF" strokeOpacity=".2" strokeWidth="2" />
      <path d="M256 68 354 229 256 283 158 229Z" fill="url(#hf-glass)" stroke="#9BFAFF" strokeWidth="5" />
      <path d="M256 68 256 283 158 229Z" fill="#20D7FF" fillOpacity=".32" />
      <path d="M256 68 354 229 256 283Z" fill="#FF57DB" fillOpacity=".27" />
      <path d="M256 80 313 221 256 256 199 221Z" fill="none" stroke="#EFFFFF" strokeOpacity=".7" strokeWidth="2" />
      <path d="M256 94 224 213M256 94 291 215M185 225 256 150 330 226" fill="none" stroke="#FFFFFF" strokeOpacity=".33" strokeWidth="2" />
      <path d="M154 235 210 219 256 283 302 219 358 235 327 310 256 420 185 310Z" fill="url(#hf-metal)" stroke="#7C8FB0" strokeWidth="4" />
      <path d="M171 246 216 236 246 284 200 327Z" fill="url(#hf-prism)" opacity=".82" />
      <path d="M341 246 296 236 266 284 312 327Z" fill="url(#hf-prism)" opacity=".82" />
      <path d="M198 319 256 405 314 319 278 336 256 374 234 336Z" fill="url(#hf-prism)" stroke="#8EFBFF" strokeWidth="3" />
      <path d="M205 247 244 292 221 314" fill="none" stroke="#27EFFF" strokeWidth="7" strokeLinecap="round" />
      <path d="M307 247 268 292 291 314" fill="none" stroke="#FF4FD8" strokeWidth="7" strokeLinecap="round" />
      <path d="M256 283 256 389" stroke="#F8FAFF" strokeOpacity=".6" strokeWidth="2" />
      <path d="M160 229 115 266 182 285M352 229 397 266 330 285" fill="none" stroke="url(#hf-ring)" strokeWidth="5" />
    </svg>
  );
}

function SpatialPreview({
  plan,
  sourcePreviewUrl,
}: {
  plan: HolographicEffectPlan | null;
  sourcePreviewUrl: string | null;
}) {
  if (!plan) {
    return (
      <div className="hf-empty-state">
        <span className="hf-empty-orb" />
        <strong>No hologram staged yet</strong>
        <p>Build a material in CREATE, then preview it here before forging it into Canva.</p>
      </div>
    );
  }

  const p = plan.parameters;
  const showSource = Boolean(plan.sourceImageRef && sourcePreviewUrl);

  return (
    <div className="hf-spatial-panel">
      <div className="hf-stage">
        <div
          className={
            "hf-hologram preset-" +
            plan.presetId +
            " creation-" +
            plan.creationType +
            " motion-" +
            p.motionMode
          }
          style={
            {
              "--hf-rx": `${66 - p.depth * 0.12}deg`,
              "--hf-rz": `${-18 + p.angle / 36}deg`,
              "--hf-glow-size": `${10 + p.glow * 0.32}px`,
              "--hf-reflect-opacity": String(0.16 + p.reflection * 0.006),
              "--hf-material-opacity": String(0.32 + (100 - p.transparency) * 0.0052),
            } as React.CSSProperties
          }
        >
          <span className="hf-holo-plane hf-holo-plane-back" />
          <span className="hf-holo-plane hf-holo-plane-mid" />
          <span className="hf-holo-plane hf-holo-plane-front">
            {showSource && (
              <img
                src={sourcePreviewUrl ?? undefined}
                className="hf-source-preview-image"
                alt="Current HoloForge source"
              />
            )}
            {plan.creationType === "holo_text" && (
              <b className="hf-spatial-text">{plan.sourceText || "HOLOFORGE"}</b>
            )}
            {plan.creationType === "light_fx" && <i className="hf-spatial-light-ring" />}
          </span>
          <span className="hf-holo-scan" />
        </div>
      </div>
      <div className="hf-preview-meta">
        <div>
          <span>ACTIVE MATERIAL</span>
          <strong>{plan.presetName}</strong>
        </div>
        <div>
          <span>OUTPUT</span>
          <strong>{plan.sourceImageRef ? "RASTER FORGE" : "APP ELEMENT"}</strong>
        </div>
      </div>
      <div className="hf-metric-grid">
        <div><span>Shift</span><strong>{p.colorShift}%</strong></div>
        <div><span>Depth</span><strong>{p.depth}%</strong></div>
        <div><span>Reflect</span><strong>{p.reflection}%</strong></div>
        <div><span>Glow</span><strong>{p.glow}%</strong></div>
      </div>
      <p className="hf-boundary-copy">
        Depth, color shift, reflection, glow, grain, angle and transparency drive the forged static material. Motion mode remains a live preview behavior because Canva app elements do not preserve HoloForge animation playback.
      </p>
    </div>
  );
}

function VerifyPanel({
  plan,
  result,
  error,
}: {
  plan: HolographicEffectPlan | null;
  result: HolographicExecutionResult | null;
  error: string | null;
}) {
  return (
    <div className="hf-verify-panel">
      <div className={"hf-proof-ring " + (result ? "is-sealed" : "")}>
        <span>{result ? "✓" : "◇"}</span>
      </div>
      <div className="hf-proof-copy">
        <span className="hf-section-kicker">FORGE RECEIPT</span>
        <h2>
          {result
            ? result.route === "DERIVED_IMAGE"
              ? "HOLOGRAPHIC IMAGE CREATED"
              : "CANVA ELEMENT CREATED"
            : "AWAITING FORGE"}
        </h2>
        <p>
          {result
            ? result.route === "DERIVED_IMAGE"
              ? "HoloForge transformed the bound raster into a derived Canva asset and inserted the forged holographic treatment into the design."
              : "HoloForge created an editable app-owned holographic design element in Canva."
            : "Forge a material to create a real Canva output and seal this receipt."}
        </p>
      </div>
      {plan && (
        <div className="hf-receipt">
          <div><span>Preset</span><strong>{plan.presetName}</strong></div>
          <div><span>Creation</span><strong>{plan.creationType.replaceAll("_", " ").toUpperCase()}</strong></div>
          <div><span>Plan</span><strong>{plan.isValid ? "VALID" : "INVALID"}</strong></div>
          <div><span>Route</span><strong>{result?.route ?? "NOT EXECUTED"}</strong></div>
        </div>
      )}
      {result && result.previewOnlyProperties.length > 0 && (
        <p className="hf-boundary-copy">
          Preview-only behavior: {result.previewOnlyProperties.join(", ")}.
        </p>
      )}
      {error && <div className="hf-error">{error}</div>}
    </div>
  );
}

export function App() {
  const [tab, setTab] = useState<StudioTab>("create");
  const [plan, setPlan] = useState<HolographicEffectPlan | null>(null);
  const [result, setResult] = useState<HolographicExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isForging, setIsForging] = useState(false);
  const selectedImage = useCanvaImageSelection();
  const [uploadedSource, setUploadedSource] = useState<UploadedImageResult | null>(null);
  const [sourceMode, setSourceMode] = useState<SourceMode>("selected");

  const activeSourceRef =
    sourceMode === "selected" ? selectedImage.ref ?? undefined : uploadedSource?.ref;
  const activeSourcePreview =
    sourceMode === "selected" ? selectedImage.previewUrl : uploadedSource?.dataUrl ?? null;
  const sourceDescription =
    sourceMode === "selected"
      ? selectedImage.ref
        ? "Selected Canva raster"
        : selectedImage.count > 1
          ? `${selectedImage.count} images selected`
          : "No Canva image selected"
      : uploadedSource?.fileName ?? "No upload staged";

  const preview = (nextPlan: HolographicEffectPlan) => {
    setPlan(nextPlan);
    setError(null);
    setTab("spatial");
  };

  const forge = async (nextPlan: HolographicEffectPlan) => {
    setPlan(nextPlan);
    setError(null);
    setResult(null);
    setIsForging(true);
    try {
      const receipt = await executeHolographicEffectPlan(nextPlan, {
        appOwned: canvaAppOwnedEffectAdapter,
        derivedImage: canvaDerivedImageAdapter,
      });
      setResult(receipt);
      setTab("verify");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "HoloForge could not create the Canva output.");
      setTab("verify");
    } finally {
      setIsForging(false);
    }
  };

  return (
    <main className="hf-app">
      <header className="hf-hero">
        <div className="hf-logo-wrap"><HoloForgeLogo /></div>
        <div className="hf-brand-copy">
          <span className="hf-eyebrow">HOLOGRAPHIC DESIGN STUDIO</span>
          <h1>HOLOFORGE</h1>
          <p>Design spectral text, logos, graphics, glass, chrome and photonic overlays inside Canva.</p>
        </div>
        <span className="hf-canva-pill">CANVA</span>
      </header>

      <section className="hf-source-dock" aria-label="HoloForge source binding">
        <div className="hf-source-dock-head">
          <div>
            <span>CANVA SOURCE</span>
            <strong>{sourceDescription}</strong>
          </div>
          <span className={"hf-source-led " + (activeSourceRef ? "is-ready" : "")} />
        </div>
        <div className="hf-source-mode-group">
          <button
            type="button"
            className={sourceMode === "selected" ? "is-active" : ""}
            disabled={!selectedImage.ref}
            onClick={() => setSourceMode("selected")}
          >
            USE SELECTED
          </button>
          <button
            type="button"
            className={sourceMode === "uploaded" ? "is-active" : ""}
            disabled={!uploadedSource}
            onClick={() => setSourceMode("uploaded")}
          >
            USE UPLOAD
          </button>
        </div>
        {selectedImage.error && <p className="hf-source-warning">{selectedImage.error}</p>}
      </section>

      <LocalImageUpload
        productName="HoloForge"
        classPrefix="hf"
        insertIntoDesign={false}
        sourceLabel="HOLOGRAM SOURCE"
        onUploaded={(uploaded) => {
          setUploadedSource(uploaded);
          setSourceMode("uploaded");
        }}
      />

      <nav className="hf-tabs" aria-label="HoloForge workflow">
        {(["create", "spatial", "verify"] as const).map((item, index) => (
          <button
            key={item}
            type="button"
            className={tab === item ? "is-active" : ""}
            aria-pressed={tab === item}
            onClick={() => setTab(item)}
          >
            <span>0{index + 1}</span>{item.toUpperCase()}
          </button>
        ))}
      </nav>

      <section className="hf-workspace">
        {tab === "create" && (
          <CreatePanel
            onPreviewHologram={preview}
            onForgeIntoCanva={forge}
            isForging={isForging}
            sourceImageRef={activeSourceRef}
            sourceKind={sourceMode}
            sourceDescription={sourceDescription}
          />
        )}
        {tab === "spatial" && (
          <SpatialPreview plan={plan} sourcePreviewUrl={activeSourcePreview} />
        )}
        {tab === "verify" && <VerifyPanel plan={plan} result={result} error={error} />}
      </section>

      <footer className="hf-footer">
        <span className="hf-signal" />
        SOURCE → MATERIAL → SPATIAL PREVIEW → CANVA FORGE
      </footer>
    </main>
  );
}
