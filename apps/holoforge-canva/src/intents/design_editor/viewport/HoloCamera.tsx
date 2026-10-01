import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { PerspectiveCamera } from "three";

import type { HoloCamera as HoloCameraSpec } from "../scene/holo-scene";

export function HoloCamera({ spec }: { spec: HoloCameraSpec }) {
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    camera.position.set(spec.position.x, spec.position.y, spec.position.z);
    camera.near = spec.near;
    camera.far = spec.far;
    camera.lookAt(spec.target.x, spec.target.y, spec.target.z);

    if (camera instanceof PerspectiveCamera) {
      camera.fov = spec.fov;
      camera.updateProjectionMatrix();
    }
  }, [camera, spec]);

  return null;
}
