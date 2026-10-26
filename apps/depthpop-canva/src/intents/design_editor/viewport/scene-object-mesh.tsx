import { TransformControls } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import type { DepthObject, ObjectTransform } from "../scene/depth-scene";
import type { TransformMode } from "./DepthViewport";
import { useCroppedObjectTexture } from "./use-cropped-object-texture";
import {
  objectWorldPosition,
  sampledTransform,
  trackValue,
  worldTransformToDepthTransform,
} from "./scene-sampling";

export function SceneObjectMesh({
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
  const opacity = trackValue(object, "opacity", currentTimeMs, object.opacity);
  const aspect = sceneWidth / Math.max(1, sceneHeight);
  const bboxWidth =
    (object.bbox.width / Math.max(1, sceneWidth)) * (aspect * 4);
  const bboxHeight = (object.bbox.height / Math.max(1, sceneHeight)) * 4;

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
              new THREE.PlaneGeometry(bboxWidth || 0.01, bboxHeight || 0.01),
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
