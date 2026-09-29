import React from "react";
import { CREATION_TYPES, type CreationType } from "../holographic/material-contract";

export type CreationTypesProps = {
  selectedType: CreationType;
  onSelectType: (type: CreationType) => void;
};

export const CreationTypes: React.FC<CreationTypesProps> = ({ selectedType, onSelectType }) => {
  return (
    <div className="hf-creation-types-grid" role="radiogroup" aria-label="Creation Type">
      {CREATION_TYPES.map((type) => {
        const isSelected = selectedType === type.id;
        return (
          <button
            key={type.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`hf-creation-type-card ${isSelected ? "is-selected" : ""}`}
            onClick={() => onSelectType(type.id)}
          >
            <span className="hf-creation-type-label">{type.label}</span>
          </button>
        );
      })}
    </div>
  );
};
