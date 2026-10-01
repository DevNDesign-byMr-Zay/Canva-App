import { useFrame } from "@react-three/fiber";
import React, { useMemo, useRef } from "react";
import { Color, ShaderMaterial } from "three";

import type { HoloMaterialSpec } from "../scene/holo-scene";

const vertexShader = `
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec3 uBaseColor;
uniform vec3 uEmissionColor;
uniform float uOpacity;
uniform float uSpectralShift;
uniform float uDiffraction;
uniform float uScanlineStrength;
uniform float uShimmerStrength;
uniform float uReflectionStrength;
uniform float uEmissionStrength;

varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
varying vec2 vUv;

vec3 spectral(float t) {
  vec3 phase = vec3(0.0, 2.0943951, 4.1887902);
  return 0.52 + 0.48 * cos(6.2831853 * t + phase);
}

void main() {
  vec3 normal = normalize(vWorldNormal);
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.15);

  float angleBand = dot(normalize(vec3(0.42, 0.68, 0.58)), normal);
  float spectralPhase =
    fresnel * (1.1 + uDiffraction * 1.8) +
    angleBand * 0.21 +
    uSpectralShift / 100.0 +
    sin(uTime * 0.42) * uShimmerStrength * 0.07;

  vec3 rainbow = spectral(spectralPhase);
  float scan = sin((vUv.y * 160.0) - uTime * 5.4);
  scan = smoothstep(0.72, 1.0, scan) * uScanlineStrength;

  float shimmer = 0.5 + 0.5 * sin(
    uTime * 1.8 +
    vWorldPosition.x * 5.5 +
    vWorldPosition.y * 3.1
  );

  vec3 color = mix(uBaseColor, rainbow, clamp(0.26 + fresnel * 0.68, 0.0, 1.0));
  color += rainbow * fresnel * (0.28 + uReflectionStrength / 160.0);
  color += uEmissionColor * uEmissionStrength * (0.12 + shimmer * uShimmerStrength * 0.24);
  color += vec3(scan * 0.18);

  float alpha = uOpacity * clamp(0.78 + fresnel * 0.32, 0.0, 1.0);
  gl_FragColor = vec4(color, alpha);
}
`;

export function SpectralHoloMaterial({ spec }: { spec: HoloMaterialSpec }) {
  const material = useRef<ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBaseColor: { value: new Color(spec.baseColor) },
      uEmissionColor: { value: new Color(spec.emissionColor) },
      uOpacity: { value: spec.opacity },
      uSpectralShift: { value: spec.spectralShift },
      uDiffraction: { value: spec.diffraction },
      uScanlineStrength: { value: spec.scanlineStrength },
      uShimmerStrength: { value: spec.shimmerStrength },
      uReflectionStrength: { value: spec.reflectionStrength },
      uEmissionStrength: { value: spec.emissionStrength },
    }),
    [spec],
  );

  useFrame(({ clock }) => {
    if (material.current) {
      material.current.uniforms.uTime!.value = clock.getElapsedTime();
    }
  });

  return (
    <shaderMaterial
      ref={material}
      uniforms={uniforms}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      transparent={spec.opacity < 0.999}
      depthWrite={spec.opacity >= 0.72}
      toneMapped={false}
    />
  );
}
