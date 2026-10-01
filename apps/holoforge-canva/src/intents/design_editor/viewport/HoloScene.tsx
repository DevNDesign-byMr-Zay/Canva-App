import React from "react";

import type { HoloScene as HoloSceneSpec } from "../scene/holo-scene";
import { HoloObject } from "./HoloObject";

export function HoloScene({
  scene,
  selectedObjectId,
  onSelectObject,
}: {
  scene: HoloSceneSpec;
  selectedObjectId: string | null;
  onSelectObject: (id: string) => void;
}) {
  return (
    <group>
      {scene.objects.map((object) => (
        <HoloObject
          key={object.id}
          object={object}
          selected={selectedObjectId === object.id}
          playing={scene.timeline.playing}
          currentTimeMs={scene.timeline.currentTimeMs}
          onSelect={onSelectObject}
        />
      ))}
    </group>
  );
}
