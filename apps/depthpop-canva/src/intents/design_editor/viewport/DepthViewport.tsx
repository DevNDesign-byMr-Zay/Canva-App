import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

import type {
  DepthScene,
  ObjectTransform,
} from "../scene/depth-scene";
import { bindWebGLRecovery } from "./webgl-recovery";

export type TransformMode = "translate" | "rotate" | "scale";

export interface DepthViewportProps {
  scene: DepthScene;
  selectedObjectId: string | null;
  transformMode?: TransformMode;
  onSelectObject?: (id: string | null) => void;
  onUpdateTransform?: (
    objectId: string,
    transform: ObjectTransform,
  ) => void;
  onUpdateCamera?: (camera: DepthScene["camera"]) => void;
  onTransformingChange?: (active: boolean) => void;
  isFallback?: boolean;
}import { ScenePlate } from "./scene-plate";
import { SceneObjectMesh } from "./scene-object-mesh";

function RecoveryBridge({
  scene,
  selectedObjectId,
  onLost,
  onRestored,
}: {
  scene: DepthScene;
  selectedObjectId: string | null;
  onLost: () => void;
  onRestored: () => void;
}) {
  const { gl } = useThree();

  useEffect(
    () =>
      bindWebGLRecovery(
        gl.domElement,
        () => ({
          sceneId: scene.id,
          selectedObjectId,
          currentTimeMs: scene.timeline.currentTimeMs,
          camera: scene.camera,
          wasPlaying: false,
        }),
        { onLost, onRestored },
      ),
    [
      gl,
      onLost,
      onRestored,
      scene.id,
      scene.camera,
      scene.timeline.currentTimeMs,
      selectedObjectId,
    ],
  );

  return null;
}

function ThreeSceneContent({
  scene,
  selectedObjectId,
  transformMode = "translate",
  onSelectObject,
  onUpdateTransform,
  onUpdateCamera,
  onTransformingChange,
  onContextLost,
  onContextRestored,
}: DepthViewportProps & {
  onContextLost: () => void;
  onContextRestored: () => void;
}) {
  const { camera } = useThree();
  const [transforming, setTransforming] = useState(false);

  useEffect(() => {
    camera.position.set(
      scene.camera.position.x,
      scene.camera.position.y,
      scene.camera.position.z,
    );
    camera.lookAt(
      scene.camera.target.x,
      scene.camera.target.y,
      scene.camera.target.z,
    );
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = scene.camera.fov;
      camera.updateProjectionMatrix();
    }
  }, [scene.camera, camera]);

  const handleTransforming = (active: boolean) => {
    setTransforming(active);
    onTransformingChange?.(active);
  };

  return (
    <>
      <RecoveryBridge
        scene={scene}
        selectedObjectId={selectedObjectId}
        onLost={onContextLost}
        onRestored={onContextRestored}
      />
      <OrbitControls
        makeDefault
        target={[
          scene.camera.target.x,
          scene.camera.target.y,
          scene.camera.target.z,
        ]}
        enabled={!transforming}
        enableDamping
        dampingFactor={0.08}
        enablePan
        enableZoom
        minDistance={0.5}
        maxDistance={24}
        onEnd={(event) => {
          if (!onUpdateCamera || !event) return;
          const controls = event.target as unknown as {
            target: THREE.Vector3;
          };
          onUpdateCamera({
            position: {
              x: Number(camera.position.x.toFixed(5)),
              y: Number(camera.position.y.toFixed(5)),
              z: Number(camera.position.z.toFixed(5)),
            },
            target: {
              x: Number(controls.target.x.toFixed(5)),
              y: Number(controls.target.y.toFixed(5)),
              z: Number(controls.target.z.toFixed(5)),
            },
            fov:
              camera instanceof THREE.PerspectiveCamera
                ? Number(camera.fov.toFixed(3))
                : scene.camera.fov,
          });
        }}
      />
      <ambientLight intensity={1} />

      {scene.reconstructedPlate.imageUrl && (
        <ScenePlate
          url={scene.reconstructedPlate.imageUrl}
          sceneWidth={scene.width}
          sceneHeight={scene.height}
        />
      )}

      {scene.objects.map((object) => (
        <SceneObjectMesh
          key={object.id}
          object={object}
          selected={object.id === selectedObjectId}
          currentTimeMs={scene.timeline.currentTimeMs}
          sceneWidth={scene.width}
          sceneHeight={scene.height}
          transformMode={transformMode}
          onSelect={() => onSelectObject?.(object.id)}
          onTransformCommit={(transform) =>
            onUpdateTransform?.(object.id, transform)
          }
          onTransformingChange={handleTransforming}
        />
      ))}
    </>
  );
}

function WebGLFallback() {
  return (
    <div className="dp-webgl-fallback" role="status">
      <strong>3D viewport unavailable</strong>
      <span>
        Precision controls remain available while WebGL is unavailable.
      </span>
    </div>
  );
}

export function DepthViewport({
  scene,
  selectedObjectId,
  transformMode = "translate",
  onSelectObject,
  onUpdateTransform,
  onUpdateCamera,
  onTransformingChange,
  isFallback = false,
}: DepthViewportProps) {
  const [hasContextError, setHasContextError] = useState(false);
  const fallback = useMemo(() => <WebGLFallback />, []);

  if (isFallback || hasContextError) {
    return (
      <div
        data-testid="depth-webgl-viewport"
        className="dp-webgl-viewport fallback"
      >
        {fallback}
      </div>
    );
  }

  return (
    <div
      data-testid="depth-webgl-viewport"
      className="dp-webgl-viewport"
    >
      <Canvas
        data-testid="depth-webgl-canvas"
        dpr={[1, 1.5]}
        frameloop="always"
        fallback={fallback}
        camera={{
          position: [
            scene.camera.position.x,
            scene.camera.position.y,
            scene.camera.position.z,
          ],
          fov: scene.camera.fov,
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.setClearColor("#111216", 1);
        }}
        onPointerMissed={() => onSelectObject?.(null)}
      >
        <ThreeSceneContent
          scene={scene}
          selectedObjectId={selectedObjectId}
          transformMode={transformMode}
          onSelectObject={onSelectObject}
          onUpdateTransform={onUpdateTransform}
          onUpdateCamera={onUpdateCamera}
          onTransformingChange={onTransformingChange}
          onContextLost={() => setHasContextError(true)}
          onContextRestored={() => setHasContextError(false)}
        />
      </Canvas>
    </div>
  );
}
