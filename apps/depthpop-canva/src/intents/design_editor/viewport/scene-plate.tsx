import { useEffect, useState } from "react";
import * as THREE from "three";

export function ScenePlate({
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
