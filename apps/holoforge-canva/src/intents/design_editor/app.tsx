import React, { useState } from "react";

import { CreatePanel } from "./create/create-panel";
import { canvaAppOwnedEffectAdapter } from "./holographic/app-owned-effect-adapter";
import {
  executeHolographicEffectPlan,
  type HolographicExecutionResult,
} from "./holographic/effect-executor";
import type { HolographicEffectPlan } from "./holographic/effect-plan";

import "./app.css";

type StudioTab = "create" | "spatial" | "verify";

function PrismMark() {
  return (
    <svg className="hf-logo-mark" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="hf-a" x1="8" y1="8" x2="55" y2="55">
          <stop offset="0" stopColor="#f8fbff" />
          <stop offset=".24" stopColor="#6ff7ff" />
          <stop offset=".52" stopColor="#a979ff" />
          <stop offset=".78" stopColor="#ff72ca" />
          <stop offset="1" stopColor="#ffd977" />
        </linearGradient>
      </defs>
      <path d="M32 4 58 50 32 60 6 50 32 4Z" fill="none" stroke="url(#hf-a)" strokeWidth="2.3" />
      <path d="M32 4v56M6 50l52 0M18 29h28L32 60 18 29Z" fill="none" stroke="url(#hf-a)" strokeWidth="1.4" opacity=".82" />
      <circle cx="32" cy="31" r="5.5" fill="url(#hf-a)" opacity=".92" />
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
        <div className="hf-logo-wrap"><PrismMark /></div>
        <div className="hf-brand-copy">
          <span className="hf-eyebrow">HOLOGRAPHIC DESIGN STUDIO</span>
          <h1>HOLOFORGE</h1>
          <p>Forge spectral materials into editable Canva design elements.</p>
        </div>
        <span className="hf-canva-pill">CANVA</span>
      </header>

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
