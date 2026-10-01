import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import React, { Suspense, useEffect, useReducer, useRef, useState } from "react";
import { SRGBColorSpace } from "three";

import type { HoloScene as HoloSceneSpec } from "../scene/holo-scene";
import {
  createHoloSceneState,
  holoSceneReducer,
  type HoloSceneAction,
} from "../scene/scene-store";
import { AnimationPanel } from "../animation/AnimationPanel";
import { ExportPanel } from "../export/ExportPanel";
import { HoloCamera } from "./HoloCamera";
import { HoloScene } from "./HoloScene";
import { MaterialInspector } from "./MaterialInspector";
import { ObjectInspector, type TransformMode } from "./ObjectInspector";
import { SceneControls } from "./SceneControls";
import { StageEnvironment } from "./StageEnvironment";

function WebGLFallback() {
  return (
    <div className="hf-webgl-fallback" role="status">
      <strong>3D viewport unavailable</strong>
      <span>WebGL could not initialize in this Canva session.</span>
    </div>
  );
}

export function HoloViewport({
  scene,
  onSceneChange,
}: {
  scene: HoloSceneSpec;
  onSceneChange?: (scene: HoloSceneSpec) => void;
}) {
  const [state, dispatch] = useReducer(
    holoSceneReducer,
    scene,
    createHoloSceneState,
  );
  const persistNextScene = useRef(false);
  const [autoOrbit, setAutoOrbit] = useState(false);
  const [controlsRevision, setControlsRevision] = useState(0);
  const [transformMode, setTransformMode] = useState<TransformMode>("rotate");
  const [transforming, setTransforming] = useState(false);

  useEffect(() => {
    dispatch({ type: "replace_scene", scene });
  }, [scene]);

  const dispatchPersistent = (action: HoloSceneAction) => {
    persistNextScene.current = true;
    dispatch(action);
  };

  useEffect(() => {
    if (!persistNextScene.current) return;
    persistNextScene.current = false;
    onSceneChange?.(state.scene);
  }, [state.scene, onSceneChange]);

  const selected =
    state.scene.objects.find((object) => object.id === state.selectedObjectId) ?? null;

  useEffect(() => {
    if (!state.scene.timeline.playing) return;

    let frame = 0;
    let lastPaint = 0;
    const duration = Math.max(1, state.scene.timeline.durationMs);
    const anchorTime = performance.now() - state.scene.timeline.currentTimeMs;

    const tick = (now: number) => {
      if (now - lastPaint >= 32) {
        dispatch({
          type: "set_time",
          currentTimeMs: (now - anchorTime) % duration,
        });
        lastPaint = now;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state.scene.timeline.playing, state.scene.timeline.durationMs]);

  return (
    <div className="hf-webgl-shell">
      <div className="hf-webgl-status">
        <span className="hf-webgl-live-dot" />
        WEBGL LIVE
        <span>{transformMode.toUpperCase()}</span>
        <b>{selected?.name ?? "SCENE"}</b>
      </div>

      <div className="hf-webgl-canvas">
        <Canvas
          dpr={[1, 1.5]}
          frameloop="always"
          fallback={<WebGLFallback />}
          camera={{ fov: state.scene.camera.fov, position: [0, 0.35, 4.3] }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
          }}
          onCreated={({ gl }) => {
            gl.outputColorSpace = SRGBColorSpace;
            gl.setClearColor(state.scene.environment.background, 1);
          }}
          onPointerMissed={() => dispatch({ type: "select_object", objectId: null })}
        >
          <color attach="background" args={[state.scene.environment.background]} />
          <HoloCamera key={controlsRevision} spec={state.scene.camera} />
          <StageEnvironment environment={state.scene.environment} />
          <Suspense fallback={null}>
            <HoloScene
              scene={state.scene}
              selectedObjectId={state.selectedObjectId}
              transformMode={transformMode}
              onSelectObject={(objectId) =>
                dispatch({ type: "select_object", objectId })
              }
              onTransformCommit={(objectId, transform) =>
                dispatchPersistent({
                  type: "patch_transform",
                  objectId,
                  transform,
                })
              }
              onTransformingChange={(active) => {
                setTransforming(active);
                if (active) {
                  setAutoOrbit(false);
                  dispatch({ type: "set_playing", playing: false });
                }
              }}
            />
          </Suspense>
          <OrbitControls
            key={"orbit-" + controlsRevision}
            makeDefault
            target={[
              state.scene.camera.target.x,
              state.scene.camera.target.y,
              state.scene.camera.target.z,
            ]}
            enabled={!transforming}
            enableDamping
            dampingFactor={0.08}
            enablePan
            enableZoom
            minDistance={2.2}
            maxDistance={8}
            autoRotate={autoOrbit && !transforming}
            autoRotateSpeed={1.15}
          />
        </Canvas>
      </div>

      <div className="hf-webgl-toolbar" aria-label="HoloForge 3D viewport controls">
        <button
          type="button"
          className={autoOrbit ? "is-active" : ""}
          onClick={() => setAutoOrbit((value) => !value)}
        >
          AUTO ORBIT
        </button>
        <button
          type="button"
          onClick={() => {
            if (state.scene.timeline.playing) {
              dispatchPersistent({ type: "set_playing", playing: false });
            } else {
              dispatch({ type: "set_playing", playing: true });
            }
          }}
        >
          {state.scene.timeline.playing ? "PAUSE FX" : "PLAY FX"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAutoOrbit(false);
            setControlsRevision((value) => value + 1);
          }}
        >
          RESET VIEW
        </button>
      </div>

      <ObjectInspector
        object={selected}
        mode={transformMode}
        onModeChange={(mode) => {
          setAutoOrbit(false);
          setTransformMode(mode);
        }}
        onPatchTransform={(transform) => {
          if (!selected) return;
          dispatch({ type: "set_playing", playing: false });
          dispatchPersistent({
            type: "patch_transform",
            objectId: selected.id,
            transform,
          });
        }}
      />

      <MaterialInspector
        object={selected}
        onPatchObject={(patch) => {
          if (!selected) return;
          dispatchPersistent({
            type: "patch_object",
            objectId: selected.id,
            patch,
          });
        }}
      />

      <SceneControls
        environment={state.scene.environment}
        camera={state.scene.camera}
        onPatchEnvironment={(environment) =>
          dispatchPersistent({
            type: "patch_environment",
            environment,
          })
        }
        onPatchCamera={(camera) => {
          setAutoOrbit(false);
          setControlsRevision((value) => value + 1);
          dispatchPersistent({
            type: "patch_camera",
            camera,
          });
        }}
      />

      <AnimationPanel
        object={selected}
        currentTimeMs={state.scene.timeline.currentTimeMs}
        durationMs={state.scene.timeline.durationMs}
        onPresetChange={(preset) => {
          if (!selected) return;
          dispatchPersistent({
            type: "set_animation_preset",
            objectId: selected.id,
            preset,
          });
        }}
        onAddPose={() => {
          if (!selected) return;
          dispatch({ type: "set_playing", playing: false });
          dispatchPersistent({
            type: "upsert_transform_pose",
            objectId: selected.id,
            timeMs: state.scene.timeline.currentTimeMs,
          });
        }}
        onRemovePose={() => {
          if (!selected) return;
          dispatchPersistent({
            type: "remove_transform_pose",
            objectId: selected.id,
            timeMs: state.scene.timeline.currentTimeMs,
          });
        }}
        onClearAnimation={() => {
          if (!selected) return;
          dispatchPersistent({ type: "clear_animation", objectId: selected.id });
          dispatch({ type: "set_playing", playing: false });
          dispatch({ type: "set_time", currentTimeMs: 0 });
        }}
      />

      <ExportPanel scene={state.scene} />

      <div className="hf-webgl-timeline">
        <span>0:00</span>
        <input
          aria-label="HoloForge timeline"
          type="range"
          min={0}
          max={state.scene.timeline.durationMs}
          step={1000 / state.scene.timeline.fps}
          value={state.scene.timeline.currentTimeMs}
          onChange={(event) => {
            dispatch({ type: "set_playing", playing: false });
            dispatchPersistent({
              type: "set_time",
              currentTimeMs: Number(event.currentTarget.value),
            });
          }}
        />
        <span>{(state.scene.timeline.durationMs / 1000).toFixed(1)}s</span>
      </div>

      <p className="hf-webgl-help">
        Select the object, MOVE / ROTATE / SCALE it, scrub time, then ADD POSE to author real
        transform keyframes. Drag empty space to orbit · wheel/pinch to zoom · right-drag to pan.
      </p>
    </div>
  );
}
