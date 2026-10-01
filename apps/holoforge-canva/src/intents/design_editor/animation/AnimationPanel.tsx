import React from "react";

import { poseTimes } from "../animation/keyframe-model";
import type { HoloAnimationPreset, HoloObject } from "../scene/holo-scene";

const PRESETS: ReadonlyArray<Readonly<{id:HoloAnimationPreset;label:string}>> = [
  { id: "static", label: "STATIC" },
  { id: "turntable", label: "TURN" },
  { id: "shimmer", label: "SHIMMER" },
  { id: "sweep", label: "SWEEP" },
  { id: "pulse", label: "PULSE" },
  { id: "orbit", label: "ORBIT" },
  { id: "custom", label: "CUSTOM" },
];

export function AnimationPanel({
  object,
  currentTimeMs,
  durationMs,
  onPresetChange,
  onAddPose,
  onRemovePose,
  onClearAnimation,
}: {
  object: HoloObject | null;
  currentTimeMs: number;
  durationMs: number;
  onPresetChange: (preset: HoloAnimationPreset) => void;
  onAddPose: () => void;
  onRemovePose: () => void;
  onClearAnimation: () => void;
}) {
  if (!object) return null;

  const times = poseTimes(object.animationTracks);
  const atPose = times.some((time) => Math.abs(time - currentTimeMs) <= 18);

  return (
    <section className="hf-animation-panel" aria-label="HoloForge animation controls">
      <div className="hf-animation-head">
        <div>
          <span>06 · TIME / MOTION</span>
          <strong>{object.animationPreset.toUpperCase()}</strong>
        </div>
        <b>{(currentTimeMs / 1000).toFixed(2)}s</b>
      </div>

      <div className="hf-animation-presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={object.animationPreset === preset.id ? "is-active" : ""}
            onClick={() => onPresetChange(preset.id)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="hf-pose-actions">
        <button type="button" onClick={onAddPose}>
          {atPose ? "UPDATE POSE" : "ADD POSE"}
        </button>
        <button
          type="button"
          disabled={!atPose}
          onClick={onRemovePose}
        >
          REMOVE POSE
        </button>
        <button
          type="button"
          disabled={object.animationTracks.length === 0 && object.animationPreset === "static"}
          onClick={onClearAnimation}
        >
          CLEAR
        </button>
      </div>

      <div className="hf-keyframe-strip" aria-label="Keyframe positions">
        {times.length === 0 ? (
          <span className="hf-no-keyframes">No custom poses yet</span>
        ) : (
          times.map((time) => (
            <i
              key={time}
              title={(time / 1000).toFixed(2) + "s"}
              className={Math.abs(time-currentTimeMs)<=18 ? "is-current" : ""}
              style={{ left: `${Math.max(0, Math.min(100, (time / durationMs) * 100))}%` }}
            />
          ))
        )}
      </div>

      <p>
        Move, rotate or scale the object, scrub to another time, then add another pose.
        HoloForge stores the motion as real transform keyframes in the scene contract.
      </p>
    </section>
  );
}
