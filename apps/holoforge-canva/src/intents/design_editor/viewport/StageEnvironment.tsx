import React from "react";

import type { HoloEnvironment } from "../scene/holo-scene";

export function StageEnvironment({ environment }: { environment: HoloEnvironment }) {
  return (
    <>
      <ambientLight intensity={environment.ambientIntensity} />
      <hemisphereLight args={["#9cecff", "#12051f", 0.72]} />
      <directionalLight
        position={[3.2, 4.5, 5]}
        intensity={environment.keyLightIntensity}
        color="#dffcff"
      />
      <pointLight
        position={[-3.5, 1.8, 2.4]}
        intensity={environment.rimLightIntensity}
        color="#9c73ff"
        distance={10}
      />
      <pointLight
        position={[3.8, -1.2, 1.6]}
        intensity={environment.rimLightIntensity * 0.72}
        color="#ff72c7"
        distance={9}
      />
      {environment.floorGrid && (
        <gridHelper
          args={[8, 24, "#28324a", "#121722"]}
          position={[0, -1.45, 0]}
        />
      )}
    </>
  );
}
