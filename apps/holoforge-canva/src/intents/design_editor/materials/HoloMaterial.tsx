import React from "react";
import { DoubleSide } from "three";

import type { HoloMaterialSpec } from "../scene/holo-scene";

export function HoloMaterial({ spec }: { spec: HoloMaterialSpec }) {
  const glassLike = spec.family === "glass" || spec.family === "crystal";
  const spectral = spec.family === "iridescent" || spec.family === "foil";

  return (
    <meshPhysicalMaterial
      color={spec.baseColor}
      emissive={spec.emissionColor}
      emissiveIntensity={spec.emissionStrength}
      metalness={spec.metalness}
      roughness={spec.roughness}
      transparent={spec.opacity < 0.999 || spec.transmission > 0}
      opacity={spec.opacity}
      transmission={spec.transmission}
      ior={spec.ior}
      thickness={glassLike ? 0.28 : 0.05}
      clearcoat={Math.min(1, 0.22 + spec.reflectionStrength / 125)}
      clearcoatRoughness={Math.max(0.03, spec.roughness * 0.55)}
      iridescence={spectral ? 1 : Math.min(1, spec.spectralShift / 135)}
      iridescenceIOR={1.3 + spec.diffraction * 0.42}
      iridescenceThicknessRange={[120, 720]}
      side={DoubleSide}
      toneMapped={false}
    />
  );
}
