import React from "react";
import {
  MATERIAL_PRESETS,
  type HolographicMaterialPreset,
} from "../holographic/material-contract";

export type MaterialPresetsProps = {
  selectedPresetId: string;
  onSelectPreset: (preset: HolographicMaterialPreset) => void;
};

export const MaterialPresets: React.FC<MaterialPresetsProps> = ({
  selectedPresetId,
  onSelectPreset,
}) => {
  return (
    <div className="hf-material-presets-grid" role="radiogroup" aria-label="Material Presets">
      {MATERIAL_PRESETS.map((preset) => {
        const isSelected = selectedPresetId === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`hf-preset-card ${isSelected ? "is-selected" : ""}`}
            onClick={() => onSelectPreset(preset)}
          >
            <div className={`hf-preset-swatch family-${preset.family}`} />
            <div className="hf-preset-info">
              <span className="hf-preset-name">{preset.name}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
