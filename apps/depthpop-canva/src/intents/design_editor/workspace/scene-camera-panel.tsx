import React from "react";
import type { Dispatch } from "react";
import type { DepthScene } from "../scene/depth-scene";
import type { SceneAction, SceneState } from "./scene-reducer";

export interface SceneCameraPanelProps {
  scene: DepthScene;
  state: SceneState;
  dispatch: Dispatch<SceneAction>;
}

export function SceneCameraPanel({
  scene,
  state,
  dispatch,
}: SceneCameraPanelProps) {
  return (
    <section className="dp-camera-panel">
      <div className="dp-camera-heading">
        <div>
          <span>VIEW</span>
          <strong>3D CAMERA</strong>
        </div>
        <button
          type="button"
          className="dp-btn-small"
          onClick={() =>
            dispatch({
              type: "PATCH_CAMERA",
              camera: state.initialScene.camera,
            })
          }
        >
          RESET CAMERA
        </button>
      </div>
      <div className="dp-inspector-grid">
        <label>
          CAMERA X
          <input
            type="range"
            aria-label="Camera X"
            min={-5}
            max={5}
            step={0.05}
            value={scene.camera.position.x}
            onChange={(event) =>
              dispatch({
                type: "PATCH_CAMERA",
                camera: {
                  position: {
                    ...scene.camera.position,
                    x: Number(event.currentTarget.value),
                  },
                },
              })
            }
          />
          <span>{scene.camera.position.x.toFixed(2)}</span>
        </label>
        <label>
          CAMERA Y
          <input
            type="range"
            aria-label="Camera Y"
            min={-5}
            max={5}
            step={0.05}
            value={scene.camera.position.y}
            onChange={(event) =>
              dispatch({
                type: "PATCH_CAMERA",
                camera: {
                  position: {
                    ...scene.camera.position,
                    y: Number(event.currentTarget.value),
                  },
                },
              })
            }
          />
          <span>{scene.camera.position.y.toFixed(2)}</span>
        </label>
        <label>
          CAMERA Z
          <input
            type="range"
            aria-label="Camera Z"
            min={0.5}
            max={12}
            step={0.05}
            value={scene.camera.position.z}
            onChange={(event) =>
              dispatch({
                type: "PATCH_CAMERA",
                camera: {
                  position: {
                    ...scene.camera.position,
                    z: Number(event.currentTarget.value),
                  },
                },
              })
            }
          />
          <span>{scene.camera.position.z.toFixed(2)}</span>
        </label>
        <label>
          FIELD OF VIEW
          <input
            type="range"
            aria-label="Field of view"
            min={20}
            max={100}
            step={1}
            value={scene.camera.fov}
            onChange={(event) =>
              dispatch({
                type: "PATCH_CAMERA",
                camera: {
                  fov: Number(event.currentTarget.value),
                },
              })
            }
          />
          <span>{scene.camera.fov.toFixed(0)}°</span>
        </label>
      </div>
      <p className="dp-help">
        Drag empty space to orbit · wheel/pinch to zoom · right-drag to pan.
        Camera navigation is persisted to the scene.
      </p>
    </section>
  );
}
