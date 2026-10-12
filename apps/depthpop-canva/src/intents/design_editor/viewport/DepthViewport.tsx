import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, TransformControls } from "@react-three/drei";
import * as THREE from "three";
import type { DepthScene, DepthObject } from "../scene/depth-scene";
import { evaluateTrackValue } from "../animation/interpolation";
import { bindWebGLRecovery } from "./webgl-recovery";

export interface DepthViewportProps {
  scene: DepthScene;
  selectedObjectId: string | null;
  onSelectObject?: (id: string | null) => void;
  onUpdateTransform?: (
    objectId: string,
    transform: DepthObject["transform"],
  ) => void;
  isFallback?: boolean;
}

function ScenePlate({ url, sceneWidth, sceneHeight }: { url: string; sceneWidth: number; sceneHeight: number }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!url) return;
    const loader = new THREE.TextureLoader();
    loader.load(url, (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace;
      setTexture(loaded);
    });
  }, [url]);

  if (!texture) return null;

  const aspect = sceneWidth / sceneHeight;
  return (
    <mesh position={[0, 0, -1]}>
      <planeGeometry args={[aspect * 4, 4]} />
      <meshBasicMaterial map={texture} depthWrite={false} />
    </mesh>
  );
}

function SceneObjectMesh({
  object,
  selected,
  currentTimeMs,
  sceneWidth,
  sceneHeight,
  onSelect,
}: {
  object: DepthObject;
  selected: boolean;
  currentTimeMs: number;
  sceneWidth: number;
  sceneHeight: number;
  onSelect: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  const cutoutUrl = object.assets?.cutoutUrl;

  useEffect(() => {
    if (!cutoutUrl) return;
    const loader = new THREE.TextureLoader();
    loader.load(cutoutUrl, (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace;
      setTexture(loaded);
    });
  }, [cutoutUrl]);

  // Compute animated or static values
  const posXTrack = object.animationTracks.find((t) => t.property === "position.x");
  const posYTrack = object.animationTracks.find((t) => t.property === "position.y");
  const posZTrack = object.animationTracks.find((t) => t.property === "position.z");
  const opacityTrack = object.animationTracks.find((t) => t.property === "opacity");

  const posX = evaluateTrackValue(posXTrack || { id: "", property: "position.x", keyframes: [] }, currentTimeMs, object.transform.position.x);
  const posY = evaluateTrackValue(posYTrack || { id: "", property: "position.y", keyframes: [] }, currentTimeMs, object.transform.position.y);
  const posZ = evaluateTrackValue(posZTrack || { id: "", property: "position.z", keyframes: [] }, currentTimeMs, object.transform.position.z);
  const opacity = evaluateTrackValue(opacityTrack || { id: "", property: "opacity", keyframes: [] }, currentTimeMs, object.opacity);

  const aspect = sceneWidth / sceneHeight;
  // Map normalized (0..1) coordinates to Three 3D world coords [-aspect*2 .. aspect*2], [2 .. -2]
  const worldX = (posX - 0.5) * (aspect * 4);
  const worldY = (0.5 - posY) * 4;
  const worldZ = posZ;

  const bboxW = (object.bbox.width / scene.width) * (aspect * 4);
  const bboxH = (object.bbox.height / scene.height) * 4;

  if (!object.visible) return null;

  return (
    <group position={[worldX, worldY, worldZ]}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        scale={[object.transform.scale.x, object.transform.scale.y, 1]}
        rotation={[
          THREE.MathUtils.degToRad(object.transform.rotation.x),
          THREE.MathUtils.degToRad(object.transform.rotation.y),
          THREE.MathUtils.degToRad(object.transform.rotation.z),
        ]}
      >
        <planeGeometry args={[bboxW || 1, bboxH || 1]} />
        <meshBasicMaterial
          map={texture || undefined}
          transparent
          opacity={opacity}
          depthWrite={false}
        />
      </mesh>
      {selected && (
        <lineSegments>
          <edgesGeometry args={[new THREE.PlaneGeometry(bboxW || 1, bboxH || 1)]} />
          <lineBasicMaterial color={object.locked ? "#ff4444" : "#00c4cc"} linewidth={2} />
        </lineSegments>
      )}
    </group>
  );
}

function ThreeSceneContent({
  scene,
  selectedObjectId,
  onSelectObject,
  onUpdateTransform,
}: DepthViewportProps) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(scene.camera.position.x, scene.camera.position.y, scene.camera.position.z);
    camera.lookAt(scene.camera.target.x, scene.camera.target.y, scene.camera.target.z);
    if ("fov" in camera) {
      (camera as THREE.PerspectiveCamera).fov = scene.camera.fov;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
  }, [scene.camera, camera]);

  const plateUrl = scene.reconstructedPlate?.imageUrl;

  return (
    <>
      <OrbitControls makeDefault enableDamping={false} />
      <ambientLight intensity={1} />

      {plateUrl && (
        <ScenePlate url={plateUrl} sceneWidth={scene.width} sceneHeight={scene.height} />
      )}

      {scene.objects.map((obj) => (
        <SceneObjectMesh
          key={obj.id}
          object={obj}
          selected={obj.id === selectedObjectId}
          currentTimeMs={scene.timeline.currentTimeMs}
          sceneWidth={scene.width}
          sceneHeight={scene.height}
          onSelect={() => onSelectObject?.(obj.id)}
        />
      ))}
    </>
  );
}

export function DepthViewport({
  scene,
  selectedObjectId,
  onSelectObject,
  onUpdateTransform,
  isFallback = false,
}: DepthViewportProps) {
  const [hasContextError, setHasContextError] = useState(false);

  useEffect(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      '[data-testid="depth-webgl-canvas"]',
    );
    if (!canvas) return;

    return bindWebGLRecovery(
      canvas,
      () => ({
        sceneId: scene.id,
        selectedObjectId,
        currentTimeMs: scene.timeline.currentTimeMs,
        camera: scene.camera,
        wasPlaying: false,
      }),
      {
        onLost: () => setHasContextError(true),
        onRestored: () => setHasContextError(false),
      },
    );
  }, [scene.id, scene.camera, scene.timeline.currentTimeMs, selectedObjectId]);

  if (isFallback || hasContextError) {
    return (
      <div
        data-testid="depth-webgl-viewport"
        className="dp-webgl-viewport fallback"
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          background: "#111",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ color: "#aaa", textAlign: "center", padding: "16px" }}>
          <p>Spatial WebGL viewport is unavailable or restored.</p>
          <p style={{ fontSize: "12px", opacity: 0.8 }}>
            Editing coordinates in Precision Inspector remains active.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="depth-webgl-viewport"
      className="dp-webgl-viewport"
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        background: "#1a1a1a",
        overflow: "hidden",
      }}
    >
      <Canvas
        data-testid="depth-webgl-canvas"
        camera={{
          position: [scene.camera.position.x, scene.camera.position.y, scene.camera.position.z],
          fov: scene.camera.fov,
        }}
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <ThreeSceneContent
          scene={scene}
          selectedObjectId={selectedObjectId}
          onSelectObject={onSelectObject}
          onUpdateTransform={onUpdateTransform}
        />
      </Canvas>
    </div>
  );
}
