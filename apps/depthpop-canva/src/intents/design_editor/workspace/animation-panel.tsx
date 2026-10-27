import React from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  AnimationEasing,
  DepthObject,
  DepthScene,
} from "../scene/depth-scene";
import { removePose } from "../animation/pose-utils";
import type { MotionPresetName } from "../animation/motion-presets";
import type { SceneAction } from "./scene-reducer";

const MOTION_PRESETS: MotionPresetName[] = [
  "PARALLAX",
  "CAMERA_PUSH",
  "FLOAT",
  "ORBIT",
  "DEPTH_REVEAL",
  "RACK_FOCUS",
];

export interface AnimationPanelProps {
  scene: DepthScene;
  selectedObject?: DepthObject;
  selectedPoseTimes: number[];
  isPlaying: boolean;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  dispatch: Dispatch<SceneAction>;
  easing: AnimationEasing;
  setEasing: Dispatch<SetStateAction<AnimationEasing>>;
  addPose: () => void;
  applyPreset: (preset: MotionPresetName) => void;
}

export function AnimationPanel({
  scene,
  selectedObject,
  selectedPoseTimes,
  isPlaying,
  setIsPlaying,
  dispatch,
  easing,
  setEasing,
  addPose,
  applyPreset,
}: AnimationPanelProps) {
  return (
    <section className="dp-animation-panel">
      <div className="dp-section-heading">
        <div>
          <span>4D TIMELINE</span>
          <h3>{selectedObject ? selectedObject.label : "SELECT AN OBJECT"}</h3>
        </div>
        <div className="dp-playback-actions">
          <button
            type="button"
            className="dp-btn-small"
            disabled={scene.timeline.durationMs <= 0}
            onClick={() => setIsPlaying((value) => !value)}
          >
            {isPlaying ? "PAUSE" : "PLAY"}
          </button>
          <button
            type="button"
            className="dp-btn-small"
            onClick={() => {
              setIsPlaying(false);
              dispatch({ type: "SET_TIME", currentTimeMs: 0 });
            }}
          >
            STOP
          </button>
        </div>
      </div>

      <div className="dp-timeline-settings">
        <label>
          DURATION
          <input
            type="number"
            min={1}
            max={120}
            step={0.5}
            value={Math.max(1, scene.timeline.durationMs / 1000)}
            onChange={(event) => {
              setIsPlaying(false);
              dispatch({
                type: "PATCH_TIMELINE",
                timeline: {
                  durationMs:
                    Math.max(1, Number(event.currentTarget.value)) * 1000,
                },
              });
            }}
          />
          <span>s</span>
        </label>
        <label>
          FPS
          <input
            type="number"
            min={1}
            max={60}
            step={1}
            value={scene.timeline.fps}
            onChange={(event) =>
              dispatch({
                type: "PATCH_TIMELINE",
                timeline: {
                  fps: Number(event.currentTarget.value),
                },
              })
            }
          />
        </label>
        <label>
          EASING
          <select
            value={easing}
            onChange={(event) =>
              setEasing(event.currentTarget.value as AnimationEasing)
            }
          >
            <option value="linear">LINEAR</option>
            <option value="ease-in">EASE IN</option>
            <option value="ease-out">EASE OUT</option>
            <option value="ease-in-out">EASE IN/OUT</option>
          </select>
        </label>
      </div>

      <label className="dp-timeline-scrubber">
        <span>TIME</span>
        <input
          type="range"
          aria-label="Timeline time"
          min={0}
          max={Math.max(1, scene.timeline.durationMs)}
          step={Math.max(1, Math.round(1000 / scene.timeline.fps))}
          value={scene.timeline.currentTimeMs}
          onChange={(event) => {
            setIsPlaying(false);
            dispatch({
              type: "SET_TIME",
              currentTimeMs: Number(event.currentTarget.value),
            });
          }}
        />
        <strong>
          {(scene.timeline.currentTimeMs / 1000).toFixed(2)} /{" "}
          {(scene.timeline.durationMs / 1000).toFixed(2)}s
        </strong>
      </label>

      <div className="dp-pose-actions">
        <button
          type="button"
          className="dp-exec"
          disabled={!selectedObject || selectedObject.locked}
          onClick={() => addPose()}
        >
          ADD / UPDATE KEYFRAME
        </button>
        <button
          type="button"
          className="dp-btn-reset"
          disabled={
            !selectedObject ||
            selectedObject.locked ||
            !selectedPoseTimes.includes(scene.timeline.currentTimeMs)
          }
          onClick={() => {
            if (!selectedObject) return;
            dispatch({
              type: "SET_ANIMATION_TRACKS",
              objectId: selectedObject.id,
              tracks: removePose(
                selectedObject.animationTracks,
                scene.timeline.currentTimeMs,
              ),
            });
          }}
        >
          DELETE KEYFRAME
        </button>
      </div>

      {selectedObject && (
        <div className="dp-keyframe-strip">
          {selectedPoseTimes.length === 0 ? (
            <span className="dp-muted">No keyframes yet.</span>
          ) : (
            selectedPoseTimes.map((timeMs) => (
              <button
                key={timeMs}
                type="button"
                className={
                  timeMs === scene.timeline.currentTimeMs ? "is-active" : ""
                }
                onClick={() => {
                  setIsPlaying(false);
                  dispatch({
                    type: "SET_TIME",
                    currentTimeMs: timeMs,
                  });
                }}
              >
                {(timeMs / 1000).toFixed(2)}s
              </button>
            ))
          )}
        </div>
      )}

      <div className="dp-motion-presets">
        <span>MOTION PRESETS</span>
        <div className="dp-preset-grid">
          {MOTION_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={scene.objects.every((object) => object.locked)}
              onClick={() => applyPreset(preset)}
            >
              {preset.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <p className="dp-help">
        Move the playhead, transform the selected object in the WebGL viewport,
        then add/update a keyframe. Transform gizmo commits automatically write
        the pose at the current time when the timeline is active.
      </p>
    </section>
  );
}
