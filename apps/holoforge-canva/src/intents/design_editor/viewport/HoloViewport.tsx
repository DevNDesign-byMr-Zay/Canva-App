import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import React, { Suspense, useEffect, useReducer, useState } from "react";
import { SRGBColorSpace } from "three";

import type { HoloScene as HoloSceneSpec } from "../scene/holo-scene";
import {
  createHoloSceneState,
  holoSceneReducer,
} from "../scene/scene-store";
import { HoloCamera } from "./HoloCamera";
import { HoloScene } from "./HoloScene";
import { StageEnvironment } from "./StageEnvironment";

function WebGLFallback() {
  return (
    <div className="hf-webgl-fallback" role="status">
      <strong>3D viewport unavailable</strong>
      <span>WebGL could not initialize in this Canva session.</span>
    </div>
  );
}

export function HoloViewport({ scene }: { scene: HoloSceneSpec }) {
  const [state, dispatch] = useReducer(
    holoSceneReducer,
    scene,
    createHoloSceneState,
  );
  const [autoOrbit, setAutoOrbit] = useState(false);
  const [controlsRevision, setControlsRevision] = useState(0);

  useEffect(() => {
    dispatch({ type: "replace_scene", scene });
  }, [scene]);

  const selected =
    state.scene.objects.find((object) => object.id === state.selectedObjectId) ?? null;

  return (
    <div className="hf-webgl-shell">
      <div className="hf-webgl-status">
        <span className="hf-webgl-live-dot" />
        WEBGL LIVE
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
          <HoloCamera spec={state.scene.camera} />
          <StageEnvironment environment={state.scene.environment} />
          <Suspense fallback={null}>
            <HoloScene
              scene={state.scene}
              selectedObjectId={state.selectedObjectId}
              onSelectObject={(objectId) =>
                dispatch({ type: "select_object", objectId })
              }
            />
          </Suspense>
          <OrbitControls
            key={controlsRevision}
            makeDefault
            target={[
              state.scene.camera.target.x,
              state.scene.camera.target.y,
              state.scene.camera.target.z,
            ]}
            enableDamping
            dampingFactor={0.08}
            enablePan
            enableZoom
            minDistance={2.2}
            maxDistance={8}
            autoRotate={autoOrbit}
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
          onClick={() =>
            dispatch({
              type: "set_playing",
              playing: !state.scene.timeline.playing,
            })
          }
        >
          {state.scene.timeline.playing ? "PAUSE" : "PLAY"}
        </button>
        <button type="button" onClick={() => setControlsRevision((value) => value + 1)}>
          RESET VIEW
        </button>
      </div>

      <div className="hf-webgl-timeline">
        <span>0:00</span>
        <input
          aria-label="HoloForge timeline"
          type="range"
          min={0}
          max={state.scene.timeline.durationMs}
          step={1000 / state.scene.timeline.fps}
          value={state.scene.timeline.currentTimeMs}
          onChange={(event) =>
            dispatch({
              type: "set_time",
              currentTimeMs: Number(event.currentTarget.value),
            })
          }
        />
        <span>{(state.scene.timeline.durationMs / 1000).toFixed(1)}s</span>
      </div>

      <p className="hf-webgl-help">
        Drag to orbit · wheel/pinch to zoom · right-drag to pan · select the hologram to inspect it.
      </p>
    </div>
  );
}
