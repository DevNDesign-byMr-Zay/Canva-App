import { useEffect, useState } from "react";
import * as THREE from "three";
import type { DepthObject } from "../scene/depth-scene";

export function useCroppedObjectTexture(
  url: string,
  object: DepthObject,
  sceneWidth: number,
  sceneHeight: number,
): THREE.Texture | null {
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
        loaded.wrapS = THREE.ClampToEdgeWrapping;
        loaded.wrapT = THREE.ClampToEdgeWrapping;

        const image = loaded.image as
          | { width?: number; height?: number }
          | undefined;
        const isFullSceneCutout =
          Number(image?.width) === sceneWidth &&
          Number(image?.height) === sceneHeight;

        if (isFullSceneCutout) {
          loaded.repeat.set(
            object.bbox.width / Math.max(1, sceneWidth),
            object.bbox.height / Math.max(1, sceneHeight),
          );
          loaded.offset.set(
            object.bbox.x / Math.max(1, sceneWidth),
            1 -
              (object.bbox.y + object.bbox.height) /
                Math.max(1, sceneHeight),
          );
        } else {
          // Future providers may return an already-cropped cutout.
          loaded.repeat.set(1, 1);
          loaded.offset.set(0, 0);
        }
        loaded.needsUpdate = true;
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
  }, [
    url,
    object.bbox.x,
    object.bbox.y,
    object.bbox.width,
    object.bbox.height,
    sceneWidth,
    sceneHeight,
  ]);

  return texture;
}
