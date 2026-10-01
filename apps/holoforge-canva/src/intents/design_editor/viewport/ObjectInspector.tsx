import React from "react";

import type { HoloObject, SceneTransform } from "../scene/holo-scene";

export type TransformMode = "translate" | "rotate" | "scale";

type Axis = "x" | "y" | "z";

function degrees(radians: number): number {
  return Number(((radians * 180) / Math.PI).toFixed(1));
}

function radians(degreesValue: number): number {
  return (degreesValue * Math.PI) / 180;
}

export function ObjectInspector({
  object,
  mode,
  onModeChange,
  onPatchTransform,
}: {
  object: HoloObject | null;
  mode: TransformMode;
  onModeChange: (mode: TransformMode) => void;
  onPatchTransform: (
    transform: Partial<{
      position: Partial<SceneTransform["position"]>;
      rotation: Partial<SceneTransform["rotation"]>;
      scale: Partial<SceneTransform["scale"]>;
    }>,
  ) => void;
}) {
  if (!object) {
    return (
      <div className="hf-object-inspector is-empty">
        <strong>NO OBJECT SELECTED</strong>
        <span>Select the hologram in the viewport to edit its transform.</span>
      </div>
    );
  }

  const patchAxis = (
    group: "position" | "rotation" | "scale",
    axis: Axis,
    raw: number,
  ) => {
    const value = group === "rotation" ? radians(raw) : raw;
    onPatchTransform({ [group]: { [axis]: value } });
  };

  const groups = [
    {
      key: "position" as const,
      label: "POSITION",
      values: object.transform.position,
      step: 0.05,
      min: -8,
      max: 8,
    },
    {
      key: "rotation" as const,
      label: "ROTATION °",
      values: {
        x: degrees(object.transform.rotation.x),
        y: degrees(object.transform.rotation.y),
        z: degrees(object.transform.rotation.z),
      },
      step: 1,
      min: -360,
      max: 360,
    },
    {
      key: "scale" as const,
      label: "SCALE",
      values: object.transform.scale,
      step: 0.05,
      min: 0.1,
      max: 5,
    },
  ];

  return (
    <div className="hf-object-inspector">
      <div className="hf-inspector-head">
        <div>
          <span>OBJECT TRANSFORM</span>
          <strong>{object.name}</strong>
        </div>
        <b>{object.geometry.type.toUpperCase()}</b>
      </div>

      <div className="hf-transform-mode" role="group" aria-label="Transform gizmo mode">
        {(["translate", "rotate", "scale"] as const).map((nextMode) => (
          <button
            key={nextMode}
            type="button"
            className={mode === nextMode ? "is-active" : ""}
            onClick={() => onModeChange(nextMode)}
          >
            {nextMode === "translate" ? "MOVE" : nextMode.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="hf-transform-fields">
        {groups.map((group) => (
          <div className="hf-transform-group" key={group.key}>
            <span>{group.label}</span>
            <div>
              {(["x", "y", "z"] as const).map((axis) => (
                <label key={axis}>
                  <b>{axis.toUpperCase()}</b>
                  <input
                    type="number"
                    aria-label={group.label + " " + axis.toUpperCase()}
                    value={group.values[axis]}
                    step={group.step}
                    min={group.min}
                    max={group.max}
                    onChange={(event) => {
                      const value = Number(event.currentTarget.value);
                      if (Number.isFinite(value)) patchAxis(group.key, axis, value);
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
