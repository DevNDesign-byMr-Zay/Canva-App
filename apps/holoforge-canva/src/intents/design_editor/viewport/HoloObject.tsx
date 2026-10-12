import { Edges } from "@react-three/drei";
import { useFrame, useLoader, type ThreeEvent } from "@react-three/fiber";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import {
  CanvasTexture,
  LinearFilter,
  SRGBColorSpace,
  TextureLoader,
  type Group,
} from "three";

import { sampleTransformTracks } from "../animation/keyframe-model";
import { samplePresetMotion } from "../animation/preset-motion";
import { useAlphaShape } from "../geometry/use-alpha-shape";
import { HoloMaterial } from "../materials/HoloMaterial";
import type { HoloObject as HoloObjectSpec } from "../scene/holo-scene";

function SourceTexture({ url, opacity }: { url: string; opacity: number }) {
  const texture = useLoader(TextureLoader, url);

  useEffect(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
  }, [texture]);

  return (
    <meshBasicMaterial
      map={texture}
      transparent
      opacity={Math.max(0, Math.min(1, opacity * 0.96))}
      toneMapped={false}
      depthWrite={false}
    />
  );
}

function useTextTexture(text: string, accent: string) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 420;
    const context = canvas.getContext("2d");
    if (!context) return null;

    context.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = context.createLinearGradient(90, 0, 920, 380);
    gradient.addColorStop(0, "#72f6ff");
    gradient.addColorStop(0.42, accent);
    gradient.addColorStop(0.76, "#ff72c7");
    gradient.addColorStop(1, "#ffe58a");
    context.font = "900 118px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.shadowBlur = 34;
    context.shadowColor = accent;
    context.fillStyle = gradient;
    context.fillText(text.slice(0, 30), 512, 210);

    const next = new CanvasTexture(canvas);
    next.colorSpace = SRGBColorSpace;
    next.needsUpdate = true;
    return next;
  }, [accent, text]);

  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

function SelectionEdges({ selected }: { selected: boolean }) {
  return selected ? <Edges color="#63efff" threshold={10} /> : null;
}

export type HoloObjectProps = {
  object: HoloObjectSpec;
  selected: boolean;
  playing: boolean;
  currentTimeMs: number;
  onSelect: (id: string) => void;
};

export const HoloObject = forwardRef<Group, HoloObjectProps>(function HoloObject(
  { object, selected, currentTimeMs, onSelect },
  forwardedRef,
) {
  const root = useRef<Group>(null);
  const animated = useRef<Group>(null);
  useImperativeHandle(forwardedRef, () => root.current as Group);

  const textTexture = useTextTexture(
    object.sourceText || object.name,
    object.material.baseColor,
  );
  const alphaShape = useAlphaShape(object.geometry.sourceUrl);
  const baseScale = object.transform.scale;

  useFrame(() => {
    const target = animated.current;
    if (!target || !object.visible) return;

    const time = currentTimeMs / 1000;
    target.position.set(0, 0, 0);
    target.rotation.set(0, 0, 0);
    target.scale.set(1, 1, 1);

    if (object.animationPreset === "custom" && object.animationTracks.length > 0) {
      const sampled = sampleTransformTracks(object.animationTracks, currentTimeMs);

      if (sampled.position) {
        target.position.set(
          sampled.position.x - object.transform.position.x,
          sampled.position.y - object.transform.position.y,
          sampled.position.z - object.transform.position.z,
        );
      }
      if (sampled.rotation) {
        target.rotation.set(
          sampled.rotation.x - object.transform.rotation.x,
          sampled.rotation.y - object.transform.rotation.y,
          sampled.rotation.z - object.transform.rotation.z,
        );
      }
      if (sampled.scale) {
        target.scale.set(
          sampled.scale.x / Math.max(0.0001, object.transform.scale.x),
          sampled.scale.y / Math.max(0.0001, object.transform.scale.y),
          sampled.scale.z / Math.max(0.0001, object.transform.scale.z),
        );
      }
      return;
    }

    const motion = samplePresetMotion(object.animationPreset, time);
    target.position.set(
      motion.position.x,
      motion.position.y,
      motion.position.z,
    );
    target.rotation.set(
      motion.rotation.x,
      motion.rotation.y,
      motion.rotation.z,
    );
    target.scale.set(
      motion.scale.x,
      motion.scale.y,
      motion.scale.z,
    );
  });

  if (!object.visible) return null;

  const commonProps = {
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      onSelect(object.id);
    },
  };

  const thickness = Math.max(0.035, object.geometry.thickness);
  const sourceUrl = object.geometry.sourceUrl;
  const frontWidth = alphaShape.width;
  const frontHeight = Math.min(2.2, Math.max(0.35, alphaShape.height));

  return (
    <group
      ref={root}
      position={[
        object.transform.position.x,
        object.transform.position.y,
        object.transform.position.z,
      ]}
      rotation={[
        object.transform.rotation.x,
        object.transform.rotation.y,
        object.transform.rotation.z,
      ]}
      scale={[baseScale.x, baseScale.y, baseScale.z]}
    >
      <group ref={animated}>
        {object.creationType === "light_fx" ? (
          <mesh {...commonProps} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.84, 0.07 + thickness * 0.08, 32, 96]} />
            <HoloMaterial spec={object.material} />
            <SelectionEdges selected={selected} />
          </mesh>
        ) : object.creationType === "holo_text" ? (
          <group>
            <mesh {...commonProps}>
              <boxGeometry args={[2.45, 1.04, thickness]} />
              <HoloMaterial spec={object.material} />
              <SelectionEdges selected={selected} />
            </mesh>
            {textTexture && (
              <mesh position={[0, 0, thickness / 2 + 0.006]}>
                <planeGeometry args={[2.28, 0.94]} />
                <meshBasicMaterial map={textTexture} transparent toneMapped={false} />
              </mesh>
            )}
          </group>
        ) : sourceUrl ? (
          <group>
            {alphaShape.shapes.length ? (
              <group>
                {alphaShape.shapes.map((shape, index) => (
                  <mesh key={index} {...commonProps}>
                    <extrudeGeometry
                      args={[
                        shape,
                        {
                          depth: thickness,
                          bevelEnabled: true,
                          bevelThickness: Math.min(thickness * 0.24, object.geometry.bevelSize),
                          bevelSize: object.geometry.bevelSize,
                          bevelSegments: Math.max(1, object.geometry.bevelSegments),
                          curveSegments: 6,
                        },
                      ]}
                    />
                    <HoloMaterial spec={object.material} />
                    <SelectionEdges selected={selected} />
                  </mesh>
                ))}
              </group>
            ) : (
              <mesh {...commonProps}>
                <boxGeometry args={[frontWidth, frontHeight, thickness]} />
                <HoloMaterial spec={object.material} />
                <SelectionEdges selected={selected} />
              </mesh>
            )}

            <mesh position={[0, 0, thickness + 0.012]}>
              <planeGeometry args={[frontWidth, frontHeight]} />
              <SourceTexture url={sourceUrl} opacity={object.material.opacity} />
            </mesh>
          </group>
        ) : object.creationType === "glass" || object.creationType === "chrome" ? (
          <mesh {...commonProps}>
            <boxGeometry args={[2.2, 1.4, thickness + 0.08]} />
            <HoloMaterial spec={object.material} />
            <SelectionEdges selected={selected} />
          </mesh>
        ) : (
          <mesh {...commonProps} rotation={[0.12, -0.18, 0]}>
            <octahedronGeometry args={[1.05, 2]} />
            <HoloMaterial spec={object.material} />
            <SelectionEdges selected={selected} />
          </mesh>
        )}
      </group>
    </group>
  );
});
