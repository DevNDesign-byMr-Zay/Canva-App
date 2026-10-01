import { TransformControls } from "@react-three/drei";
import React, { useRef } from "react";
import type { Group } from "three";

import type { HoloObject as HoloObjectSpec, HoloScene as HoloSceneSpec, SceneTransform } from "../scene/holo-scene";
import { HoloObject } from "./HoloObject";
import type { TransformMode } from "./ObjectInspector";

function EditableObject({
  object,
  selected,
  playing,
  currentTimeMs,
  mode,
  onSelectObject,
  onTransformCommit,
  onTransformingChange,
}: {
  object: HoloObjectSpec;
  selected: boolean;
  playing: boolean;
  currentTimeMs: number;
  mode: TransformMode;
  onSelectObject: (id: string) => void;
  onTransformCommit: (
    objectId: string,
    transform: Pick<SceneTransform, "position" | "rotation" | "scale">,
  ) => void;
  onTransformingChange: (active: boolean) => void;
}) {
  const objectRef = useRef<Group>(null);

  const hologram = (
    <HoloObject
      ref={objectRef}
      object={object}
      selected={selected}
      playing={playing}
      currentTimeMs={currentTimeMs}
      onSelect={onSelectObject}
    />
  );

  if (!selected) return hologram;

  return (
    <TransformControls
      mode={mode}
      space={mode === "translate" ? "world" : "local"}
      size={0.72}
      onMouseDown={() => onTransformingChange(true)}
      onMouseUp={() => {
        onTransformingChange(false);
        const target = objectRef.current;
        if (!target) return;

        onTransformCommit(object.id, {
          position: {
            x: Number(target.position.x.toFixed(4)),
            y: Number(target.position.y.toFixed(4)),
            z: Number(target.position.z.toFixed(4)),
          },
          rotation: {
            x: Number(target.rotation.x.toFixed(5)),
            y: Number(target.rotation.y.toFixed(5)),
            z: Number(target.rotation.z.toFixed(5)),
          },
          scale: {
            x: Number(target.scale.x.toFixed(4)),
            y: Number(target.scale.y.toFixed(4)),
            z: Number(target.scale.z.toFixed(4)),
          },
        });
      }}
    >
      {hologram}
    </TransformControls>
  );
}

export function HoloScene({
  scene,
  selectedObjectId,
  transformMode,
  onSelectObject,
  onTransformCommit,
  onTransformingChange,
}: {
  scene: HoloSceneSpec;
  selectedObjectId: string | null;
  transformMode: TransformMode;
  onSelectObject: (id: string) => void;
  onTransformCommit: (
    objectId: string,
    transform: Pick<SceneTransform, "position" | "rotation" | "scale">,
  ) => void;
  onTransformingChange: (active: boolean) => void;
}) {
  return (
    <group>
      {scene.objects.map((object) => (
        <EditableObject
          key={object.id}
          object={object}
          selected={selectedObjectId === object.id}
          playing={scene.timeline.playing}
          currentTimeMs={scene.timeline.currentTimeMs}
          mode={transformMode}
          onSelectObject={onSelectObject}
          onTransformCommit={onTransformCommit}
          onTransformingChange={onTransformingChange}
        />
      ))}
    </group>
  );
}
