import type { HoloObject, SceneTransform } from "./holo-scene";

export type HoloObjectPatch = Readonly<{
  name?: string;
  visible?: boolean;
  transform?: Partial<{
    position: Partial<SceneTransform["position"]>;
    rotation: Partial<SceneTransform["rotation"]>;
    scale: Partial<SceneTransform["scale"]>;
  }>;
}>;

export function patchHoloObject(object: HoloObject, patch: HoloObjectPatch): HoloObject {
  const transformPatch = patch.transform;
  return Object.freeze({
    ...object,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.visible !== undefined ? { visible: patch.visible } : {}),
    transform: transformPatch
      ? Object.freeze({
          position: Object.freeze({
            ...object.transform.position,
            ...transformPatch.position,
          }),
          rotation: Object.freeze({
            ...object.transform.rotation,
            ...transformPatch.rotation,
          }),
          scale: Object.freeze({
            ...object.transform.scale,
            ...transformPatch.scale,
          }),
        })
      : object.transform,
  });
}
