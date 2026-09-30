import React, { useState } from "react";

import { CreatePanel } from "./create/create-panel";
import { canvaAppOwnedEffectAdapter } from "./holographic/app-owned-effect-adapter";
import {
  executeHolographicEffectPlan,
  type HolographicExecutionResult,
} from "./holographic/effect-executor";
import type { HolographicEffectPlan } from "./holographic/effect-plan";
import { LocalImageUpload } from "./local-image-upload";

import "./app.css";

type StudioTab = "create" | "spatial" | "verify";

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

function SpatialPreview({ plan }: { plan: HolographicEffectPlan | null }) {
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
  return (
    <div className="hf-spatial-panel">
      <div className="hf-stage">
        <div className={"hf-hologram preset-" + plan.presetId}>
          <span className="hf-holo-plane hf-holo-plane-back" />
          <span className="hf-holo-plane hf-holo-plane-mid" />
          <span className="hf-holo-plane hf-holo-plane-front" />
          <span className="hf-holo-scan" />
        </div>
      </div>
      <div className="hf-preview-meta">
        <div>
          <span>ACTIVE MATERIAL</span>
          <strong>{plan.presetName}</strong>
        </div>
        <div>
          <span>MODE</span>
          <strong>{p.motionMode.toUpperCase()}</strong>
        </div>
      </div>
      <div className="hf-metric-grid">
        <div><span>Shift</span><strong>{p.colorShift}%</strong></div>
        <div><span>Depth</span><strong>{p.depth}%</strong></div>
        <div><span>Reflect</span><strong>{p.reflection}%</strong></div>
        <div><span>Glow</span><strong>{p.glow}%</strong></div>
      </div>
      <p className="hf-boundary-copy">
        Spatial depth and motion are preview semantics. Forge writes only supported editable HoloForge app-element properties into Canva.
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
        <h2>{result ? "CANVA ELEMENT CREATED" : "AWAITING FORGE"}</h2>
        <p>
          {result
            ? "HoloForge received a successful Canva app-element write response for the current material."
            : "Forge a supported material to create an editable app-owned element and seal this receipt."}
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
          Preview-only properties retained outside the Canva write: {result.previewOnlyProperties.join(", ")}.
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
      const receipt = await executeHolographicEffectPlan(nextPlan, canvaAppOwnedEffectAdapter);
      setResult(receipt);
      setTab("verify");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "HoloForge could not create the Canva element.");
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
          <p>Forge spectral materials into editable Canva design elements.</p>
        </div>
        <span className="hf-canva-pill">CANVA</span>
      </header>

      <LocalImageUpload productName="HoloForge" classPrefix="hf" />

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
          />
        )}
        {tab === "spatial" && <SpatialPreview plan={plan} />}
        {tab === "verify" && <VerifyPanel plan={plan} result={result} error={error} />}
      </section>

      <footer className="hf-footer">
        <span className="hf-signal" />
        APP-OWNED MATERIAL ENGINE · EXPLICIT USER ACTION
      </footer>
    </main>
  );
}
