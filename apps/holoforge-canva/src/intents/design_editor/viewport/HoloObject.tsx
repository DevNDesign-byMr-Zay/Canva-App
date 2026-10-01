import { Edges } from "@react-three/drei";
import { useFrame, useLoader, type ThreeEvent } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef } from "react";
import {
  CanvasTexture,
  LinearFilter,
  SRGBColorSpace,
  TextureLoader,
  type Group,
} from "three";

import { HoloMaterial } from "../materials/HoloMaterial";
import type { HoloObject as HoloObjectSpec } from "../scene/holo-scene";

function SourceTexture({ url }: { url: string }) {
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
      opacity={0.96}
      toneMapped={false}
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

export function HoloObject({
  object,
  selected,
  playing,
  currentTimeMs,
  onSelect,
}: {
  object: HoloObjectSpec;
  selected: boolean;
  playing: boolean;
  currentTimeMs: number;
  onSelect: (id: string) => void;
}) {
  const group = useRef<Group>(null);
  const textTexture = useTextTexture(object.sourceText || object.name, object.material.baseColor);
  const baseScale = object.transform.scale;

  useFrame(({ clock }) => {
    const target = group.current;
    if (!target || !object.visible) return;

    const time = playing ? clock.getElapsedTime() : currentTimeMs / 1000;
    target.rotation.set(
      object.transform.rotation.x,
      object.transform.rotation.y,
      object.transform.rotation.z,
    );
    target.scale.set(baseScale.x, baseScale.y, baseScale.z);

    switch (object.animationPreset) {
      case "shimmer":
        target.rotation.y += Math.sin(time * 1.25) * 0.18;
        target.rotation.x += Math.cos(time * 0.8) * 0.045;
        break;
      case "sweep":
        target.rotation.y += time * 0.34;
        break;
      case "pulse": {
        const pulse = 1 + Math.sin(time * 2.4) * 0.045;
        target.scale.multiplyScalar(pulse);
        break;
      }
      case "turntable":
        target.rotation.y += time * 0.5;
        break;
      case "orbit":
        target.position.x =
          object.transform.position.x + Math.cos(time * 0.55) * 0.32;
        target.position.z =
          object.transform.position.z + Math.sin(time * 0.55) * 0.18;
        break;
      default:
        break;
    }
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

  return (
    <group
      ref={group}
      position={[
        object.transform.position.x,
        object.transform.position.y,
        object.transform.position.z,
      ]}
    >
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
          <mesh {...commonProps}>
            <boxGeometry args={[2.35, 1.52, thickness]} />
            <HoloMaterial spec={object.material} />
            <SelectionEdges selected={selected} />
          </mesh>
          <mesh position={[0, 0, thickness / 2 + 0.008]}>
            <planeGeometry args={[2.26, 1.43]} />
            <SourceTexture url={sourceUrl} />
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
  );
}
