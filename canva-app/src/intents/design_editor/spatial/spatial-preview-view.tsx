import React from "react";
import type { SpatialPreviewModel } from "../spatial-preview";

export type SpatialPreviewViewProps = {
  model: SpatialPreviewModel | null;
  selectedElementId: string | null;
  onSelectElement: (elementId: string) => void;
  viewMode: "holo" | "source";
};

export const SpatialPreviewView: React.FC<SpatialPreviewViewProps> = ({
  model,
  selectedElementId,
  onSelectElement,
  viewMode,
}) => {
  if (!model || !model.elements.length) {
    return (
      <div className="hf-spatial-stage-empty">
        <span className="hf-empty-text">No active spatial elements to display.</span>
      </div>
    );
  }

  const sortedElements = [...model.elements].sort((a, b) => a.depth - b.depth);

  return (
    <div className="hf-spatial-stage" aria-label="2.5D Spatial Scene Preview">
      <div className="hf-spatial-stage-viewport">
        {sortedElements.map((element, index) => {
          const isSelected = selectedElementId === element.elementId;
          const geometry = viewMode === "holo" ? element.candidate : element.source;
          const depthOffset = (element.depth / 100) * 14;

          return (
            <div
              key={element.elementId}
              role="button"
              tabIndex={0}
              aria-label={`Element ${element.elementId}, depth ${element.depth}`}
              className={`hf-spatial-layer-card ${isSelected ? "is-selected" : ""} ${
                element.changed ? "is-changed" : ""
              }`}
              style={{
                transform: `translate3d(${depthOffset}px, ${-depthOffset}px, 0) rotate(${geometry.rotation}deg)`,
                zIndex: index + 1,
              }}
              onClick={() => onSelectElement(element.elementId)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectElement(element.elementId);
                }
              }}
            >
              <div className="hf-spatial-layer-header">
                <span className="hf-layer-id">{element.elementId}</span>
                <span className="hf-layer-depth">z {element.depth}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
