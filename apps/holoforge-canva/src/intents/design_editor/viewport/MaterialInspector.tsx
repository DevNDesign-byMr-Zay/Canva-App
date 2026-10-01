import React from "react";

import type { MaterialFamily } from "../holographic/material-contract";
import type { HoloObject } from "../scene/holo-scene";
import type { HoloObjectPatch } from "../scene/holo-object";

const MATERIAL_FAMILIES: readonly MaterialFamily[] = [
  "iridescent",
  "glass",
  "foil",
  "metal",
  "pearl",
  "neon",
  "crystal",
];

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="hf-material-slider">
      <span>
        <b>{label}</b>
        <strong>{display}</strong>
      </span>
      <input
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

export function MaterialInspector({
  object,
  onPatchObject,
}: {
  object: HoloObject | null;
  onPatchObject: (patch: HoloObjectPatch) => void;
}) {
  if (!object) return null;

  const material = object.material;
  const geometry = object.geometry;

  return (
    <section className="hf-material-inspector" aria-label="HoloForge material and geometry controls">
      <div className="hf-material-inspector-head">
        <div>
          <span>04 · MATERIAL / FORM</span>
          <strong>{material.family.toUpperCase()}</strong>
        </div>
        <button
          type="button"
          className={object.visible ? "is-active" : ""}
          aria-pressed={object.visible}
          onClick={() => onPatchObject({ visible: !object.visible })}
        >
          {object.visible ? "VISIBLE" : "HIDDEN"}
        </button>
      </div>

      <label className="hf-material-family">
        <span>MATERIAL FAMILY</span>
        <select
          value={material.family}
          onChange={(event) =>
            onPatchObject({
              material: {
                family: event.currentTarget.value as MaterialFamily,
              },
            })
          }
        >
          {MATERIAL_FAMILIES.map((family) => (
            <option key={family} value={family}>
              {family.toUpperCase()}
            </option>
          ))}
        </select>
      </label>

      <div className="hf-material-quick">
        <Slider
          label="OPACITY"
          value={material.opacity}
          min={0}
          max={1}
          step={0.01}
          display={Math.round(material.opacity * 100) + "%"}
          onChange={(opacity) => onPatchObject({ material: { opacity } })}
        />
        <Slider
          label="REFLECTION"
          value={material.reflectionStrength}
          min={0}
          max={100}
          step={1}
          display={Math.round(material.reflectionStrength) + "%"}
          onChange={(reflectionStrength) =>
            onPatchObject({ material: { reflectionStrength } })
          }
        />
        <Slider
          label="GLOW"
          value={material.emissionStrength}
          min={0}
          max={3}
          step={0.05}
          display={material.emissionStrength.toFixed(2)}
          onChange={(emissionStrength) =>
            onPatchObject({ material: { emissionStrength } })
          }
        />
      </div>

      <details className="hf-material-details">
        <summary>PHYSICAL / SPECTRAL</summary>
        <div className="hf-material-detail-grid">
          <Slider
            label="METAL"
            value={material.metalness}
            min={0}
            max={1}
            step={0.01}
            display={material.metalness.toFixed(2)}
            onChange={(metalness) => onPatchObject({ material: { metalness } })}
          />
          <Slider
            label="ROUGHNESS"
            value={material.roughness}
            min={0.02}
            max={1}
            step={0.01}
            display={material.roughness.toFixed(2)}
            onChange={(roughness) => onPatchObject({ material: { roughness } })}
          />
          <Slider
            label="TRANSMISSION"
            value={material.transmission}
            min={0}
            max={1}
            step={0.01}
            display={material.transmission.toFixed(2)}
            onChange={(transmission) =>
              onPatchObject({ material: { transmission } })
            }
          />
          <Slider
            label="IOR"
            value={material.ior}
            min={1}
            max={2.5}
            step={0.01}
            display={material.ior.toFixed(2)}
            onChange={(ior) => onPatchObject({ material: { ior } })}
          />
          <Slider
            label="SPECTRAL SHIFT"
            value={material.spectralShift}
            min={0}
            max={100}
            step={1}
            display={Math.round(material.spectralShift) + "%"}
            onChange={(spectralShift) =>
              onPatchObject({ material: { spectralShift } })
            }
          />
          <Slider
            label="DIFFRACTION"
            value={material.diffraction}
            min={0}
            max={1}
            step={0.01}
            display={material.diffraction.toFixed(2)}
            onChange={(diffraction) =>
              onPatchObject({ material: { diffraction } })
            }
          />
          <Slider
            label="SHIMMER"
            value={material.shimmerStrength}
            min={0}
            max={1}
            step={0.01}
            display={material.shimmerStrength.toFixed(2)}
            onChange={(shimmerStrength) =>
              onPatchObject({ material: { shimmerStrength } })
            }
          />
          <Slider
            label="SCANLINE"
            value={material.scanlineStrength}
            min={0}
            max={1}
            step={0.01}
            display={material.scanlineStrength.toFixed(2)}
            onChange={(scanlineStrength) =>
              onPatchObject({ material: { scanlineStrength } })
            }
          />
        </div>
      </details>

      <details className="hf-material-details">
        <summary>GEOMETRY</summary>
        <div className="hf-material-detail-grid">
          <Slider
            label="THICKNESS"
            value={geometry.thickness}
            min={0.01}
            max={0.8}
            step={0.01}
            display={geometry.thickness.toFixed(2)}
            onChange={(thickness) => onPatchObject({ geometry: { thickness } })}
          />
          <Slider
            label="BEVEL"
            value={geometry.bevelSize}
            min={0}
            max={0.15}
            step={0.005}
            display={geometry.bevelSize.toFixed(3)}
            onChange={(bevelSize) => onPatchObject({ geometry: { bevelSize } })}
          />
          <Slider
            label="BEVEL SEGMENTS"
            value={geometry.bevelSegments}
            min={0}
            max={8}
            step={1}
            display={String(geometry.bevelSegments)}
            onChange={(bevelSegments) =>
              onPatchObject({ geometry: { bevelSegments } })
            }
          />
        </div>
      </details>
    </section>
  );
}
