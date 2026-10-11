import type {
  BBox,
  DepthObject,
  DepthScene,
  ObjectTransform,
  Vector3,
} from "../scene/depth-scene";

export const DEPTHPOP_WORLD_HEIGHT = 2.4;
export const DEPTHPOP_WORLD_Z_SCALE = 0.5;

export interface WorldTransform {
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
}

export function sceneWorldSize(
  scene: Pick<DepthScene, "width" | "height">,
): { width: number; height: number } {
  const aspect = scene.width / scene.height;
  return {
    width: DEPTHPOP_WORLD_HEIGHT * aspect,
    height: DEPTHPOP_WORLD_HEIGHT,
  };
}

export function bboxToWorldSize(
  bbox: BBox,
  scene: Pick<DepthScene, "width" | "height">,
): { width: number; height: number } {
  const world = sceneWorldSize(scene);
  return {
    width: (bbox.width / scene.width) * world.width,
    height: (bbox.height / scene.height) * world.height,
  };
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

export function depthObjectToWorld(
  object: Pick<DepthObject, "transform">,
  scene: Pick<DepthScene, "width" | "height">,
): WorldTransform {
  const world = sceneWorldSize(scene);
  return {
    position: {
      x: (object.transform.position.x - 0.5) * world.width,
      y: (0.5 - object.transform.position.y) * world.height,
      z: object.transform.position.z * DEPTHPOP_WORLD_Z_SCALE,
    },
    rotation: {
      x: degreesToRadians(object.transform.rotation.x),
      y: degreesToRadians(object.transform.rotation.y),
      z: degreesToRadians(object.transform.rotation.z),
    },
    scale: { ...object.transform.scale },
  };
}

export function worldTransformToDepthObject(
  worldTransform: WorldTransform,
  _object: Pick<DepthObject, "transform">,
  scene: Pick<DepthScene, "width" | "height">,
): ObjectTransform {
  const world = sceneWorldSize(scene);
  return {
    position: {
      x: worldTransform.position.x / world.width + 0.5,
      y: 0.5 - worldTransform.position.y / world.height,
      z: worldTransform.position.z / DEPTHPOP_WORLD_Z_SCALE,
    },
    rotation: {
      x: radiansToDegrees(worldTransform.rotation.x),
      y: radiansToDegrees(worldTransform.rotation.y),
      z: radiansToDegrees(worldTransform.rotation.z),
    },
    scale: { ...worldTransform.scale },
  };
}
