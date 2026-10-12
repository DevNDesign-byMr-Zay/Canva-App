import { OrbitControls, TransformControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { evaluateTrackValue } from "../animation/interpolation";
import type {
  DepthObject,
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
}

function trackValue(
  object: DepthObject,
  property: DepthObject["animationTracks"][number]["property"],
  currentTimeMs: number,
  fallback: number,
): number {
  const track = object.animationTracks.find(
    (candidate) => candidate.property === property,
  );
  if (!track) return fallback;
  return evaluateTrackValue(track, currentTimeMs, fallback);
}

function sampledTransform(
  object: DepthObject,
  currentTimeMs: number,
): ObjectTransform {
  return {
    position: {
      x: trackValue(
        object,
        "position.x",
        currentTimeMs,
        object.transform.position.x,
      ),
      y: trackValue(
        object,
        "position.y",
        currentTimeMs,
        object.transform.position.y,
      ),
      z: trackValue(
        object,
        "position.z",
        currentTimeMs,
        object.transform.position.z,
      ),
    },
    rotation: {
      x: trackValue(
        object,
        "rotation.x",
        currentTimeMs,
        object.transform.rotation.x,
      ),
      y: trackValue(
        object,
        "rotation.y",
        currentTimeMs,
        object.transform.rotation.y,
      ),
      z: trackValue(
        object,
        "rotation.z",
        currentTimeMs,
        object.transform.rotation.z,
      ),
    },
    scale: {
      x: trackValue(
        object,
        "scale.x",
        currentTimeMs,
        object.transform.scale.x,
      ),
      y: trackValue(
        object,
        "scale.y",
        currentTimeMs,
        object.transform.scale.y,
      ),
      z: trackValue(
        object,
        "scale.z",
        currentTimeMs,
        object.transform.scale.z,
      ),
    },
  };
}

function ScenePlate({
  url,
  sceneWidth,
  sceneHeight,
}: {
  url: string;
  sceneWidth: number;
  sceneHeight: number;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!url) {
      setTexture(null);
      return;
    }
    let active = true;
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (loaded) => {
        if (!active) {
          loaded.dispose();
          return;
        }
        loaded.colorSpace = THREE.SRGBColorSpace;
        setTexture(loaded);
      },
      undefined,
      () => {
        if (active) setTexture(null);
      },
    );
    return () => {
      active = false;
      setTexture((previous) => {
        previous?.dispose();
        return null;
      });
    };
  }, [url]);

  if (!texture) return null;

  const aspect = sceneWidth / Math.max(1, sceneHeight);
  return (
    <mesh
      name="DepthPop reconstructed plate"
      position={[0, 0, -2]}
      renderOrder={-1000}
    >
      <planeGeometry args={[aspect * 4, 4]} />
      <meshBasicMaterial
        map={texture}
        transparent={false}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function useCroppedObjectTexture(
  url: string,
  object: DepthObject,
  sceneWidth: number,
  sceneHeight: number,
): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!url) {
      setTexture(null);
      return;
    }

    let active = true;
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (loaded) => {
        if (!active) {
          loaded.dispose();
          return;
        }
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.wrapS = THREE.ClampToEdgeWrapping;
        loaded.wrapT = THREE.ClampToEdgeWrapping;

        const image = loaded.image as
          | { width?: number; height?: number }
          | undefined;
        const isFullSceneCutout =
          Number(image?.width) === sceneWidth &&
          Number(image?.height) === sceneHeight;

        if (isFullSceneCutout) {
          loaded.repeat.set(
            object.bbox.width / Math.max(1, sceneWidth),
            object.bbox.height / Math.max(1, sceneHeight),
          );
          loaded.offset.set(
            object.bbox.x / Math.max(1, sceneWidth),
            1 -
              (object.bbox.y + object.bbox.height) /
                Math.max(1, sceneHeight),
          );
        } else {
          // Future providers may return an already-cropped cutout.
          loaded.repeat.set(1, 1);
          loaded.offset.set(0, 0);
        }
        loaded.needsUpdate = true;
        setTexture(loaded);
      },
      undefined,
      () => {
        if (active) setTexture(null);
      },
    );

    return () => {
      active = false;
      setTexture((previous) => {
        previous?.dispose();
        return null;
      });
    };
  }, [
    url,
    object.bbox.x,
    object.bbox.y,
    object.bbox.width,
    object.bbox.height,
    sceneWidth,
    sceneHeight,
  ]);

  return texture;
}

function objectWorldPosition(
  transform: ObjectTransform,
  aspect: number,
): [number, number, number] {
  return [
    (transform.position.x - 0.5) * (aspect * 4),
    (0.5 - transform.position.y) * 4,
    transform.position.z,
  ];
}

function worldTransformToDepthTransform(
  group: THREE.Group,
  sceneWidth: number,
  sceneHeight: number,
): ObjectTransform {
  const aspect = sceneWidth / Math.max(1, sceneHeight);
  return {
    position: {
      x: Number((group.position.x / (aspect * 4) + 0.5).toFixed(5)),
      y: Number((0.5 - group.position.y / 4).toFixed(5)),
      z: Number(group.position.z.toFixed(5)),
    },
    rotation: {
      x: Number(THREE.MathUtils.radToDeg(group.rotation.x).toFixed(4)),
      y: Number(THREE.MathUtils.radToDeg(group.rotation.y).toFixed(4)),
      z: Number(THREE.MathUtils.radToDeg(group.rotation.z).toFixed(4)),
    },
    scale: {
      x: Number(group.scale.x.toFixed(5)),
      y: Number(group.scale.y.toFixed(5)),
      z: Number(group.scale.z.toFixed(5)),
    },
  };
}

function SceneObjectMesh({
  object,
  selected,
  currentTimeMs,
  sceneWidth,
  sceneHeight,
  transformMode,
  onSelect,
  onTransformCommit,
  onTransformingChange,
}: {
  object: DepthObject;
  selected: boolean;
  currentTimeMs: number;
  sceneWidth: number;
  sceneHeight: number;
  transformMode: TransformMode;
  onSelect: () => void;
  onTransformCommit: (transform: ObjectTransform) => void;
  onTransformingChange: (active: boolean) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const texture = useCroppedObjectTexture(
    object.assets.cutoutUrl,
    object,
    sceneWidth,
    sceneHeight,
  );
  const transform = sampledTransform(object, currentTimeMs);
  const opacity = trackValue(
    object,
    "opacity",
    currentTimeMs,
    object.opacity,
  );
  const aspect = sceneWidth / Math.max(1, sceneHeight);
  const bboxWidth =
    (object.bbox.width / Math.max(1, sceneWidth)) * (aspect * 4);
  const bboxHeight =
    (object.bbox.height / Math.max(1, sceneHeight)) * 4;

  const objectNode = (
    <group
      ref={groupRef}
      position={objectWorldPosition(transform, aspect)}
      rotation={[
        THREE.MathUtils.degToRad(transform.rotation.x),
        THREE.MathUtils.degToRad(transform.rotation.y),
        THREE.MathUtils.degToRad(transform.rotation.z),
      ]}
      scale={[
        transform.scale.x,
        transform.scale.y,
        Math.max(0.001, transform.scale.z),
      ]}
    >
      <mesh
        name={object.label}
        renderOrder={object.order}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      >
        <planeGeometry args={[bboxWidth || 0.01, bboxHeight || 0.01]} />
        <meshBasicMaterial
          map={texture ?? undefined}
          transparent
          alphaTest={0.01}
          opacity={opacity}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {selected && (
        <lineSegments renderOrder={10000}>
          <edgesGeometry
            args={[
              new THREE.PlaneGeometry(
                bboxWidth || 0.01,
                bboxHeight || 0.01,
              ),
            ]}
          />
          <lineBasicMaterial
            color={object.locked ? "#ff4d67" : "#8d72ff"}
            depthTest={false}
          />
        </lineSegments>
      )}
    </group>
  );

  if (!object.visible) return null;
  if (!selected || object.locked) return objectNode;

  return (
    <TransformControls
      mode={transformMode}
      space={transformMode === "translate" ? "world" : "local"}
      size={0.72}
      onMouseDown={() => onTransformingChange(true)}
      onMouseUp={() => {
        onTransformingChange(false);
        if (!groupRef.current) return;
        onTransformCommit(
          worldTransformToDepthTransform(
            groupRef.current,
            sceneWidth,
            sceneHeight,
          ),
        );
      }}
    >
      {objectNode}
    </TransformControls>
  );
}

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
