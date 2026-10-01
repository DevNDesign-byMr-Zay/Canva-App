import type {
  HoloGeometrySpec,
  HoloMaterialSpec,
  HoloObject,
  SceneTransform,
} from "./holo-scene";

export type HoloObjectPatch = Readonly<{
  name?: string;
  visible?: boolean;
  material?: Partial<HoloMaterialSpec>;
  geometry?: Partial<HoloGeometrySpec>;
  transform?: Partial<{
    position: Partial<SceneTransform["position"]>;
    rotation: Partial<SceneTransform["rotation"]>;
    scale: Partial<SceneTransform["scale"]>;
  }>;
}>;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function patchMaterial(
  material: HoloMaterialSpec,
  patch?: Partial<HoloMaterialSpec>,
): HoloMaterialSpec {
  if (!patch) return material;

  return Object.freeze({
    ...material,
    ...patch,
    opacity:
      patch.opacity === undefined
        ? material.opacity
        : clamp(patch.opacity, 0, 1),
    metalness:
      patch.metalness === undefined
        ? material.metalness
        : clamp(patch.metalness, 0, 1),
    roughness:
      patch.roughness === undefined
        ? material.roughness
        : clamp(patch.roughness, 0.02, 1),
    transmission:
      patch.transmission === undefined
        ? material.transmission
        : clamp(patch.transmission, 0, 1),
    ior:
      patch.ior === undefined
        ? material.ior
        : clamp(patch.ior, 1, 2.5),
    emissionStrength:
      patch.emissionStrength === undefined
        ? material.emissionStrength
        : clamp(patch.emissionStrength, 0, 5),
    spectralShift:
      patch.spectralShift === undefined
        ? material.spectralShift
        : clamp(patch.spectralShift, 0, 100),
    diffraction:
      patch.diffraction === undefined
        ? material.diffraction
        : clamp(patch.diffraction, 0, 1),
    scanlineStrength:
      patch.scanlineStrength === undefined
        ? material.scanlineStrength
        : clamp(patch.scanlineStrength, 0, 1),
    shimmerStrength:
      patch.shimmerStrength === undefined
        ? material.shimmerStrength
        : clamp(patch.shimmerStrength, 0, 1),
    reflectionStrength:
      patch.reflectionStrength === undefined
        ? material.reflectionStrength
        : clamp(patch.reflectionStrength, 0, 100),
  });
}

function patchGeometry(
  geometry: HoloGeometrySpec,
  patch?: Partial<HoloGeometrySpec>,
): HoloGeometrySpec {
  if (!patch) return geometry;

  return Object.freeze({
    ...geometry,
    ...patch,
    thickness:
      patch.thickness === undefined
        ? geometry.thickness
        : clamp(patch.thickness, 0.01, 2),
    bevelSize:
      patch.bevelSize === undefined
        ? geometry.bevelSize
        : clamp(patch.bevelSize, 0, 0.5),
    bevelSegments:
      patch.bevelSegments === undefined
        ? geometry.bevelSegments
        : Math.round(clamp(patch.bevelSegments, 0, 8)),
  });
}

export function patchHoloObject(object: HoloObject, patch: HoloObjectPatch): HoloObject {
  const transformPatch = patch.transform;
  return Object.freeze({
    ...object,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.visible !== undefined ? { visible: patch.visible } : {}),
    material: patchMaterial(object.material, patch.material),
    geometry: patchGeometry(object.geometry, patch.geometry),
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
