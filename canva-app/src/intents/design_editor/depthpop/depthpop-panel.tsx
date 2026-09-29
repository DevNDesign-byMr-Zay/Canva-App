import React, { useMemo, useState } from "react";

import type { CanvaDesignSnapshot } from "../canva-design";
import {
  DEFAULT_DEPTHPOP_SETTINGS,
  buildDepthPopExecutionParameters,
  getDepthPopExecutionCapability,
  normalizeDepthPopSettings,
  type DepthPopQuality,
  type DepthPopSettings,
} from "./depthpop-model";

export type DepthPopPanelProps = {
  snapshot: CanvaDesignSnapshot | null;
  isReading: boolean;
  onRefresh: () => void | Promise<void>;
};

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
    <label className="dp-control-row" title={hint}>
      <span className="dp-control-label">
        <span>{label}</span>
        <strong>{displayValue}</strong>
      </span>
      <input
        className="dp-slider"
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

function DepthPopIcon() {
  return (
    <svg className="dp-drive-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 7h10v10H7V7Z" stroke="currentColor" strokeWidth="1.6" opacity=".35" />
      <path d="M5 9h10v10H5V9Z" stroke="currentColor" strokeWidth="1.6" opacity=".6" />
      <path d="M9 5h10v10H9V5Z" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M14.5 10.5c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2Z"
        fill="currentColor"
        opacity=".85"
      />
    </svg>
  );
}

export const DepthPopPanel: React.FC<DepthPopPanelProps> = ({ snapshot, isReading, onRefresh }) => {
  const [settings, setSettings] = useState<DepthPopSettings>(DEFAULT_DEPTHPOP_SETTINGS);
  const execution = useMemo(() => getDepthPopExecutionCapability(), []);
  const parameters = useMemo(() => buildDepthPopExecutionParameters(settings), [settings]);

  const setSetting = (key: "depthStrength" | "depthBlur" | "depthFidelity", value: number) => {
    setSettings((current) => normalizeDepthPopSettings({ ...current, [key]: value }));
  };

  const setQuality = (quality: DepthPopQuality) => {
    setSettings((current) => normalizeDepthPopSettings({ ...current, quality }));
  };

  return (
    <section className="dp-shell" aria-labelledby="depthpop-title">
      <div className="dp-topline">
        <span className="dp-heroicon">
          <DepthPopIcon />
        </span>
        <span className="dp-canva-chip">CANVA</span>
      </div>

      <div className="dp-title" id="depthpop-title">
        DEPTHPOP
      </div>
      <div className="dp-chip">DEPTH POP</div>
      <p className="dp-desc">
        Turn depth into presence — subtle separation, cinematic focus, same scene.
      </p>

      <div className="dp-controls" aria-label="DepthPop controls">
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
          hint="Blurs the background based on depth. 0% subtle, 100% dramatic."
          value={settings.depthBlur}
          min={0}
          max={100}
          step={1}
          displayValue={`${Math.round(settings.depthBlur)}%`}
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

        <div className="dp-control-row dp-quality-control">
          <span className="dp-control-label">
            <span>Render Quality</span>
            <strong>steps {parameters.numInferenceSteps}</strong>
          </span>
          <div className="dp-quality-row" role="group" aria-label="DepthPop render quality">
            {(["fast", "balanced", "cinematic"] as const).map((quality) => (
              <button
                key={quality}
                type="button"
                className={settings.quality === quality ? "is-active" : ""}
                aria-pressed={settings.quality === quality}
                onClick={() => setQuality(quality)}
              >
                {quality === "fast" ? "Fast" : quality === "balanced" ? "Balanced" : "Cinematic"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="dp-canvas-status">
        <div>
          <span className="dp-status-label">CANVA SOURCE</span>
          <strong>
            {snapshot
              ? `${snapshot.designTitle ?? "Current design"} · ${snapshot.elements.length} element${snapshot.elements.length === 1 ? "" : "s"}`
              : "Current design not read"}
          </strong>
        </div>
        <button className="dp-source-btn" type="button" disabled={isReading} onClick={onRefresh}>
          {isReading ? "Reading…" : snapshot ? "Refresh" : "Read"}
        </button>
      </div>

      <div className="dp-actions">
        <p className="dp-provider-note">{execution.reason}</p>
        <button className="dp-exec" type="button" disabled aria-disabled="true">
          EXECUTE DEPTHPOP
        </button>
        <p className="dp-boundary-note">
          Visual controls and parameter mapping match the maintained Drive v115 DepthPop panel.
          Execution remains fail-closed inside Canva until the authenticated provider seam exists.
        </p>
      </div>
    </section>
  );
};
