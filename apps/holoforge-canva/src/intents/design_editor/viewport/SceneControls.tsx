import React from "react";

import type {
  HoloCamera,
  HoloEnvironment,
} from "../scene/holo-scene";

type CameraPatch = Partial<{
  position: Partial<HoloCamera["position"]>;
  target: Partial<HoloCamera["target"]>;
  fov: number;
  near: number;
  far: number;
}>;

const CAMERA_PRESETS: ReadonlyArray<
  Readonly<{
    id: string;
    label: string;
    camera: CameraPatch;
  }>
> = [
  {
    id: "front",
    label: "FRONT",
    camera: {
      position: { x: 0, y: 0.35, z: 4.3 },
      target: { x: 0, y: 0, z: 0 },
      fov: 42,
    },
  },
  {
    id: "hero",
    label: "HERO",
    camera: {
      position: { x: 2.25, y: 1.25, z: 4.65 },
      target: { x: 0, y: 0.08, z: 0 },
      fov: 38,
    },
  },
  {
    id: "close",
    label: "CLOSE",
    camera: {
      position: { x: 0.55, y: 0.18, z: 2.8 },
      target: { x: 0, y: 0, z: 0 },
      fov: 34,
    },
  },
];

function numberValue(event: React.ChangeEvent<HTMLInputElement>): number | null {
  const value = Number(event.currentTarget.value);
  return Number.isFinite(value) ? value : null;
}

function LightSlider({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="hf-scene-slider">
      <span>
        <b>{label}</b>
        <strong>{value.toFixed(2)}</strong>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        step={0.05}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  );
}

function VectorFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: HoloCamera["position"];
  onChange: (axis: "x" | "y" | "z", value: number) => void;
}) {
  return (
    <div className="hf-scene-vector">
      <span>{label}</span>
      <div>
        {(["x", "y", "z"] as const).map((axis) => (
          <label key={axis}>
            <b>{axis.toUpperCase()}</b>
            <input
              type="number"
              step={0.05}
              min={-20}
              max={20}
              value={Number(value[axis].toFixed(3))}
              onChange={(event) => {
                const next = numberValue(event);
                if (next !== null) onChange(axis, next);
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

export function SceneControls({
  environment,
  camera,
  onPatchEnvironment,
  onPatchCamera,
}: {
  environment: HoloEnvironment;
  camera: HoloCamera;
  onPatchEnvironment: (patch: Partial<HoloEnvironment>) => void;
  onPatchCamera: (patch: CameraPatch) => void;
}) {
  return (
    <section className="hf-scene-controls" aria-label="HoloForge scene and camera controls">
      <div className="hf-scene-controls-head">
        <div>
          <span>04 · SCENE / CAMERA</span>
          <strong>LIVE STAGE</strong>
        </div>
        <button
          type="button"
          className={environment.floorGrid ? "is-active" : ""}
          aria-pressed={environment.floorGrid}
          onClick={() =>
            onPatchEnvironment({ floorGrid: !environment.floorGrid })
          }
        >
          GRID
        </button>
      </div>

      <div className="hf-camera-presets" role="group" aria-label="Camera presets">
        {CAMERA_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onPatchCamera(preset.camera)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="hf-scene-color">
        <label>
          <span>BACKGROUND</span>
          <input
            type="color"
            aria-label="Scene background color"
            value={environment.background}
            onChange={(event) =>
              onPatchEnvironment({ background: event.currentTarget.value })
            }
          />
        </label>
        <label>
          <span>FIELD OF VIEW</span>
          <strong>{Math.round(camera.fov)}°</strong>
          <input
            type="range"
            min={20}
            max={80}
            step={1}
            value={camera.fov}
            onChange={(event) =>
              onPatchCamera({ fov: Number(event.currentTarget.value) })
            }
          />
        </label>
      </div>

      <div className="hf-scene-light-grid">
        <LightSlider
          label="AMBIENT"
          value={environment.ambientIntensity}
          max={2.5}
          onChange={(value) => onPatchEnvironment({ ambientIntensity: value })}
        />
        <LightSlider
          label="KEY"
          value={environment.keyLightIntensity}
          max={5}
          onChange={(value) => onPatchEnvironment({ keyLightIntensity: value })}
        />
        <LightSlider
          label="RIM"
          value={environment.rimLightIntensity}
          max={5}
          onChange={(value) => onPatchEnvironment({ rimLightIntensity: value })}
        />
      </div>

      <details className="hf-camera-details">
        <summary>CAMERA COORDINATES</summary>
        <VectorFields
          label="POSITION"
          value={camera.position}
          onChange={(axis, value) =>
            onPatchCamera({ position: { [axis]: value } })
          }
        />
        <VectorFields
          label="TARGET"
          value={camera.target}
          onChange={(axis, value) =>
            onPatchCamera({ target: { [axis]: value } })
          }
        />
      </details>
    </section>
  );
}
