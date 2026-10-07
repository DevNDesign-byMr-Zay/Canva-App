import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import React, { Suspense, useRef, useState } from "react";
import type { Mesh } from "three";
import { SRGBColorSpace } from "three";

import type { DepthObject, DepthScene } from "../scene/depth-scene";
import { normalizedToWorld } from "./scene-coordinates";
import { bindWebGLRecovery } from "./webgl-recovery";

function DepthObjectMesh({
  object,
  selected,
  onSelect,
}: {
  object: DepthObject;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const meshRef = useRef<Mesh>(null);
  const worldPos = normalizedToWorld(
    object.transform.position.x,
    object.transform.position.y,
    object.transform.position.z,
  );

  return (
    <mesh
      ref={meshRef}
      position={[worldPos.x, worldPos.y, worldPos.z]}
      rotation={[
        (object.transform.rotation.x * Math.PI) / 180,
        (object.transform.rotation.y * Math.PI) / 180,
        (object.transform.rotation.z * Math.PI) / 180,
      ]}
      scale={[
        object.transform.scale.x,
        object.transform.scale.y,
        object.transform.scale.z,
      ]}
      visible={object.visible}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(object.id);
      }}
    >
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial
        transparent
        opacity={object.opacity}
        color={selected ? "#3b82f6" : "#ffffff"}
      />
    </mesh>
  );
}

export function DepthViewport({
  scene,
  selectedObjectId,
  onSelectObject,
}: {
  scene: DepthScene;
  selectedObjectId?: string | null;
  onSelectObject?: (id: string | null) => void;
  onTransformChange?: (
    objectId: string,
    transform: { position: { x: number; y: number; z: number } },
  ) => void;
}) {
  const [contextLost, setContextLost] = useState(false);

  return (
    <div
      className="dp-webgl-viewport-container"
      data-testid="depth-webgl-viewport"
      data-scene-id={scene.id}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      {contextLost ? (
        <div className="dp-webgl-fallback" role="status">
          <strong>3D Viewport Restoring</strong>
          <span>WebGL context was temporarily interrupted.</span>
        </div>
      ) : (
        <Canvas
          camera={{
            position: [
              scene.camera.position.x,
              scene.camera.position.y,
              scene.camera.position.z,
            ],
            fov: scene.camera.fov,
          }}
          onCreated={({ gl }) => {
            gl.outputColorSpace = SRGBColorSpace;
            bindWebGLRecovery(
              gl.domElement,
              () => ({
                sceneId: scene.id,
                selectedObjectId: selectedObjectId ?? null,
                currentTimeMs: scene.timeline.currentTimeMs,
                camera: scene.camera,
                wasPlaying: false,
              }),
              {
                onLost: () => setContextLost(true),
                onRestored: () => setContextLost(false),
              },
            );
          }}
        >
          <ambientLight intensity={1.2} />
          <Suspense fallback={null}>
            {scene.objects.map((obj) => (
              <DepthObjectMesh
                key={obj.id}
                object={obj}
                selected={obj.id === selectedObjectId}
                onSelect={(id) => onSelectObject && onSelectObject(id)}
              />
            ))}
          </Suspense>
          <OrbitControls makeDefault />
        </Canvas>
      )}
    </div>
  );
}
