import { Alert, Button, Text, Title } from "@canva/app-ui-kit";
import { FormattedMessage } from "react-intl";
import React, { useMemo, useState } from "react";

import type { CanvaDesignSnapshot } from "../canva-design";
import {
  DEFAULT_DEPTHPOP_SETTINGS,
  buildDepthPopPreviewModel,
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
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="dp-control-row">
      <span className="dp-control-label">
        <span>{label}</span>
        <strong>{Math.round(value)}%</strong>
      </span>
      <input
        className="dp-slider"
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  );
}

export const DepthPopPanel: React.FC<DepthPopPanelProps> = ({
  snapshot,
  isReading,
  onRefresh,
}) => {
  const [settings, setSettings] = useState<DepthPopSettings>(DEFAULT_DEPTHPOP_SETTINGS);
  const [previewOn, setPreviewOn] = useState(true);
  const preview = useMemo(() => buildDepthPopPreviewModel(settings), [settings]);
  const execution = useMemo(() => getDepthPopExecutionCapability(), []);

  const setNumber = (key: "depth" | "bokeh" | "focus" | "edgeLift", value: number) => {
    setSettings((current) => normalizeDepthPopSettings({ ...current, [key]: value }));
  };

  const setQuality = (quality: DepthPopQuality) => {
    setSettings((current) => normalizeDepthPopSettings({ ...current, quality }));
  };

  const previewStyle = {
    "--dp-bg-scale": String(previewOn ? preview.backgroundScale : 1),
    "--dp-subject-scale": String(previewOn ? preview.subjectScale : 1),
    "--dp-fg-scale": String(previewOn ? preview.foregroundScale : 1),
    "--dp-bg-blur": `${previewOn ? preview.backgroundBlurPx : 0}px`,
    "--dp-subject-lift": `${previewOn ? preview.subjectLiftPx : 0}px`,
    "--dp-glow-opacity": String(previewOn ? preview.glowOpacity : 0),
    "--dp-focus-x": `${preview.focusPositionPercent}%`,
  } as React.CSSProperties;

  return (
    <section className="dp-shell" aria-labelledby="depthpop-title">
      <header className="dp-hero">
        <div className="dp-brand-row">
          <div className="dp-brand-lockup">
            <span className="dp-mark" aria-hidden="true" />
            <div>
              <div className="dp-kicker">SPATIAL IMAGE LAB</div>
              <div id="depthpop-title">
                <Title>DepthPop</Title>
              </div>
            </div>
          </div>
          <span className="dp-state-pill">CANVA</span>
        </div>
        <Text>
          <FormattedMessage
            defaultMessage="Shape perceived depth, focus and bokeh without exposing the legacy AETHER shell."
            description="DepthPop product purpose statement."
          />
        </Text>
      </header>

      <div className="dp-preview-card">
        <div className="dp-preview-topline">
          <div>
            <span className="dp-card-eyebrow">LIVE PREVIEW</span>
            <strong>Depth field</strong>
          </div>
          <button
            type="button"
            className={`dp-preview-toggle ${previewOn ? "is-on" : ""}`}
            aria-pressed={previewOn}
            onClick={() => setPreviewOn((value) => !value)}
          >
            {previewOn ? "ON" : "OFF"}
          </button>
        </div>

        <div className="dp-stage" style={previewStyle} aria-label="DepthPop preview visualization">
          <div className="dp-stage-grid" />
          <div className="dp-depth-plane dp-depth-plane-back" />
          <div className="dp-depth-plane dp-depth-plane-subject">
            <span className="dp-depth-orb" />
            <span className="dp-depth-caption">SUBJECT</span>
          </div>
          <div className="dp-depth-plane dp-depth-plane-front" />
          <span className="dp-focus-beam" aria-hidden="true" />
        </div>

        <div className="dp-metrics">
          <span>DEPTH {Math.round(settings.depth)}</span>
          <span>BOKEH {Math.round(settings.bokeh)}</span>
          <span>FOCUS {Math.round(settings.focus)}</span>
        </div>
      </div>

      <div className="dp-card">
        <div className="dp-card-header">
          <div>
            <span className="dp-card-eyebrow">01 · CANVAS</span>
            <strong>Source context</strong>
          </div>
          <span className={`dp-state-pill ${snapshot ? "is-ready" : ""}`}>
            {snapshot ? "READY" : "NOT READ"}
          </span>
        </div>
        <div className="dp-source-copy">
          <Text>
            {snapshot
              ? `${snapshot.designTitle ?? "Current design"} · ${snapshot.elements.length} element${snapshot.elements.length === 1 ? "" : "s"}`
              : "Read the current Canva page before preparing a DepthPop pass."}
          </Text>
        </div>
        <Button variant="secondary" stretch loading={isReading} onClick={onRefresh}>
          {snapshot ? "Refresh canvas" : "Read canvas"}
        </Button>
      </div>

      <div className="dp-card">
        <div className="dp-card-header">
          <div>
            <span className="dp-card-eyebrow">02 · DEPTH ENGINE</span>
            <strong>Optical controls</strong>
          </div>
          <span className="dp-state-pill is-ready">PREVIEW</span>
        </div>

        <div className="dp-controls">
          <SliderControl
            label="Depth strength"
            value={settings.depth}
            onChange={(value) => setNumber("depth", value)}
          />
          <SliderControl
            label="Bokeh"
            value={settings.bokeh}
            onChange={(value) => setNumber("bokeh", value)}
          />
          <SliderControl
            label="Focus point"
            value={settings.focus}
            onChange={(value) => setNumber("focus", value)}
          />
          <SliderControl
            label="Edge lift"
            value={settings.edgeLift}
            onChange={(value) => setNumber("edgeLift", value)}
          />
        </div>

        <div className="dp-quality-block">
          <span className="dp-card-eyebrow">QUALITY</span>
          <div className="dp-quality-tabs" role="group" aria-label="DepthPop render quality">
            {(["fast", "balanced", "max"] as const).map((quality) => (
              <button
                key={quality}
                type="button"
                className={settings.quality === quality ? "is-active" : ""}
                aria-pressed={settings.quality === quality}
                onClick={() => setQuality(quality)}
              >
                {quality.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="dp-card dp-execute-card">
        <div className="dp-card-header">
          <div>
            <span className="dp-card-eyebrow">03 · OUTPUT</span>
            <strong>DepthPop pass</strong>
          </div>
          <span className="dp-state-pill is-locked">LOCKED</span>
        </div>
        <Alert tone="info">{execution.reason}</Alert>
        <Button variant="primary" stretch disabled>
          APPLY DEPTHPOP
        </Button>
        <p className="dp-boundary-note">
          The UI is production-built now. The apply action intentionally fails closed instead of routing to the historical AETHER/ROARY runtime.
        </p>
      </div>
    </section>
  );
};
