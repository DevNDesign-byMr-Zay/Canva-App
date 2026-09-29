import React, { useState } from "react";
import { Alert, Text } from "@canva/app-ui-kit";
import { FormattedMessage } from "react-intl";
import type { SpatialPreviewModel } from "../spatial-preview";
import { SpatialPreviewView } from "./spatial-preview-view";
import { getPropertyCapability } from "../holographic/capability-matrix";
import type { HolographicEffectPlan } from "../holographic/effect-plan";

export type SpatialPanelProps = {
  spatialModel: SpatialPreviewModel | null;
  effectPlan?: HolographicEffectPlan | null;
  selectedElementId: string | null;
  onSelectElement: (elementId: string | null) => void;
};

export const SpatialPanel: React.FC<SpatialPanelProps> = ({
  spatialModel,
  effectPlan = null,
  selectedElementId,
  onSelectElement,
}) => {
  const [viewMode, setViewMode] = useState<"holo" | "source">("holo");
  const [customDepth, setCustomDepth] = useState(50);
  const [customRotation, setCustomRotation] = useState(0);

  const selectedElement = spatialModel?.elements.find(
    (element) => element.elementId === selectedElementId,
  );

  return (
    <div
      className="hf-spatial-panel"
      id="panel-spatial"
      role="tabpanel"
      aria-labelledby="tab-spatial"
    >
      <div className="hf-section-header">
        <span className="hf-section-kicker">
          <FormattedMessage defaultMessage="2.5D SCENE PREVIEW" description="Scene preview kicker" />
        </span>
        <div className="hf-sub-tab-group" role="radiogroup" aria-label="Compare View">
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === "holo"}
            className={`hf-sub-tab ${viewMode === "holo" ? "is-active" : ""}`}
            onClick={() => setViewMode("holo")}
          >
            Holo
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === "source"}
            className={`hf-sub-tab ${viewMode === "source" ? "is-active" : ""}`}
            onClick={() => setViewMode("source")}
          >
            Source
          </button>
        </div>
      </div>

      <SpatialPreviewView
        model={spatialModel}
        selectedElementId={selectedElementId}
        onSelectElement={onSelectElement}
        viewMode={viewMode}
      />

      {effectPlan && (
        <div className="hf-material-preview-card">
          <div className="hf-material-preview-swatch" aria-hidden="true" />
          <div>
            <span className="hf-section-kicker">MATERIAL PREVIEW</span>
            <Text>{effectPlan.presetName}</Text>
            <Text>
              <FormattedMessage
                defaultMessage="Depth {depth}% · Glow {glow}% · Reflection {reflection}%"
                description="Compact material preview parameter summary."
                values={{
                  depth: effectPlan.parameters.depth,
                  glow: effectPlan.parameters.glow,
                  reflection: effectPlan.parameters.reflection,
                }}
              />
            </Text>
          </div>
        </div>
      )}

      {spatialModel?.elements.length ? (
        <div className="hf-spatial-element-list">
          <span className="hf-section-kicker">DEPTH LAYERS</span>
          <div className="hf-layer-stack">
            {spatialModel.elements.map((element) => (
              <button
                key={element.elementId}
                type="button"
                className={`hf-layer-row ${
                  selectedElementId === element.elementId ? "is-selected" : ""
                }`}
                onClick={() => onSelectElement(element.elementId)}
              >
                <span className="hf-layer-title">{element.elementId}</span>
                <span className="hf-layer-badge">z {element.depth}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Alert tone="info">
          <FormattedMessage
            defaultMessage="Preview a material or verify a scenario to inspect spatial layers."
            description="Empty state for spatial view."
          />
        </Alert>
      )}

      {selectedElement && (
        <div className="hf-section hf-selected-element-controls">
          <span className="hf-section-kicker">
            <FormattedMessage
              defaultMessage="SELECTED: {id}"
              description="Selected spatial element heading."
              values={{ id: selectedElement.elementId }}
            />
          </span>

          <label htmlFor="ctrl-spatial-depth" className="hf-control-label">
            Presentation Depth
            <span className="hf-control-value">z {customDepth}</span>
          </label>
          <input
            id="ctrl-spatial-depth"
            type="range"
            min={0}
            max={100}
            value={customDepth}
            className="hf-slider"
            onChange={(event) => setCustomDepth(Number(event.target.value))}
          />

          <label htmlFor="ctrl-spatial-rotation" className="hf-control-label">
            Rotation Preview
            <span className="hf-control-value">{customRotation}°</span>
          </label>
          <input
            id="ctrl-spatial-rotation"
            type="range"
            min={-180}
            max={180}
            value={customRotation}
            className="hf-slider"
            onChange={(event) => setCustomRotation(Number(event.target.value))}
          />

          <div className="hf-capability-badge-row">
            <span className="hf-cap-pill is-native">
              {getPropertyCapability("rotation").tier}
            </span>
            <span className="hf-cap-pill is-preview">
              {getPropertyCapability("depth").tier}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
