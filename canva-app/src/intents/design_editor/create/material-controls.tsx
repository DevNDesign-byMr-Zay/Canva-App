import React, { useState } from "react";
import { FormattedMessage } from "react-intl";
import type { MotionMode } from "../holographic/material-contract";

export type MaterialParameters = {
  colorShift: number;
  depth: number;
  reflection: number;
  glow: number;
  grain: number;
  angle: number;
  transparency: number;
  motionMode: MotionMode;
};

export type MaterialControlsProps = {
  parameters: MaterialParameters;
  onChangeParameter: <K extends keyof MaterialParameters>(
    key: K,
    value: MaterialParameters[K],
  ) => void;
};

export const MaterialControls: React.FC<MaterialControlsProps> = ({
  parameters,
  onChangeParameter,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="hf-material-controls">
      <div className="hf-control-row">
        <label htmlFor="ctrl-colorShift" className="hf-control-label">
          <FormattedMessage defaultMessage="Color Shift" description="Color shift control label" />
          <span className="hf-control-value">{parameters.colorShift}%</span>
        </label>
        <input
          id="ctrl-colorShift"
          type="range"
          min={0}
          max={100}
          value={parameters.colorShift}
          className="hf-slider"
          onChange={(e) => onChangeParameter("colorShift", Number(e.target.value))}
        />
      </div>

      <div className="hf-control-row">
        <label htmlFor="ctrl-reflection" className="hf-control-label">
          <FormattedMessage defaultMessage="Reflection" description="Reflection control label" />
          <span className="hf-control-value">{parameters.reflection}%</span>
        </label>
        <input
          id="ctrl-reflection"
          type="range"
          min={0}
          max={100}
          value={parameters.reflection}
          className="hf-slider"
          onChange={(e) => onChangeParameter("reflection", Number(e.target.value))}
        />
      </div>

      <div className="hf-control-row">
        <label htmlFor="ctrl-glow" className="hf-control-label">
          <FormattedMessage defaultMessage="Glow" description="Glow control label" />
          <span className="hf-control-value">{parameters.glow}%</span>
        </label>
        <input
          id="ctrl-glow"
          type="range"
          min={0}
          max={100}
          value={parameters.glow}
          className="hf-slider"
          onChange={(e) => onChangeParameter("glow", Number(e.target.value))}
        />
      </div>

      <div className="hf-control-row">
        <span className="hf-control-label">
          <FormattedMessage defaultMessage="Motion Mode" description="Motion mode label" />
        </span>
        <div className="hf-motion-btn-group" role="radiogroup" aria-label="Motion Mode">
          {(["static", "shimmer", "sweep", "pulse"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={parameters.motionMode === mode}
              className={`hf-motion-btn ${parameters.motionMode === mode ? "is-selected" : ""}`}
              onClick={() => onChangeParameter("motionMode", mode)}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="hf-accordion">
        <button
          type="button"
          className="hf-accordion-header"
          aria-expanded={showAdvanced}
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <span>
            <FormattedMessage
              defaultMessage="Advanced Controls"
              description="Accordion header for advanced controls"
            />
          </span>
          <span className="hf-accordion-icon">{showAdvanced ? "▲" : "▼"}</span>
        </button>

        {showAdvanced && (
          <div className="hf-accordion-content">
            <div className="hf-control-row">
              <label htmlFor="ctrl-depth" className="hf-control-label">
                <FormattedMessage defaultMessage="Depth" description="Depth control label" />
                <span className="hf-control-value">{parameters.depth}%</span>
              </label>
              <input
                id="ctrl-depth"
                type="range"
                min={0}
                max={100}
                value={parameters.depth}
                className="hf-slider"
                onChange={(e) => onChangeParameter("depth", Number(e.target.value))}
              />
            </div>

            <div className="hf-control-row">
              <label htmlFor="ctrl-grain" className="hf-control-label">
                <FormattedMessage defaultMessage="Grain" description="Grain control label" />
                <span className="hf-control-value">{parameters.grain}%</span>
              </label>
              <input
                id="ctrl-grain"
                type="range"
                min={0}
                max={100}
                value={parameters.grain}
                className="hf-slider"
                onChange={(e) => onChangeParameter("grain", Number(e.target.value))}
              />
            </div>

            <div className="hf-control-row">
              <label htmlFor="ctrl-angle" className="hf-control-label">
                <FormattedMessage defaultMessage="Angle" description="Angle control label" />
                <span className="hf-control-value">{parameters.angle}°</span>
              </label>
              <input
                id="ctrl-angle"
                type="range"
                min={0}
                max={360}
                value={parameters.angle}
                className="hf-slider"
                onChange={(e) => onChangeParameter("angle", Number(e.target.value))}
              />
            </div>

            <div className="hf-control-row">
              <label htmlFor="ctrl-transparency" className="hf-control-label">
                <FormattedMessage defaultMessage="Transparency" description="Transparency control label" />
                <span className="hf-control-value">{parameters.transparency}%</span>
              </label>
              <input
                id="ctrl-transparency"
                type="range"
                min={0}
                max={100}
                value={parameters.transparency}
                className="hf-slider"
                onChange={(e) => onChangeParameter("transparency", Number(e.target.value))}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
