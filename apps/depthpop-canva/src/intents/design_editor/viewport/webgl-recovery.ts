export type WebGLRecoverySnapshot = {
  sceneId: string;
  selectedObjectId: string | null;
  currentTimeMs: number;
  camera: {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
    fov: number;
  };
  wasPlaying: boolean;
};

export type WebGLRecoveryOptions = {
  onLost?: (snapshot: WebGLRecoverySnapshot) => void;
  onRestored?: (snapshot: WebGLRecoverySnapshot) => void;
};

const boundCanvases = new WeakSet<HTMLCanvasElement>();

export function bindWebGLRecovery(
  canvas: HTMLCanvasElement,
  getSnapshot: () => WebGLRecoverySnapshot,
  options: WebGLRecoveryOptions = {},
): () => void {
  if (boundCanvases.has(canvas)) {
    return () => {};
  }
  boundCanvases.add(canvas);

  let activeSnapshot: WebGLRecoverySnapshot | null = null;

  const handleContextLost = (event: Event) => {
    event.preventDefault();
    activeSnapshot = getSnapshot();
    if (options.onLost) {
      options.onLost(activeSnapshot);
    }
  };

  const handleContextRestored = () => {
    const snap = activeSnapshot ?? getSnapshot();
    if (options.onRestored) {
      options.onRestored(snap);
    }
  };

  canvas.addEventListener("webglcontextlost", handleContextLost);
  canvas.addEventListener("webglcontextrestored", handleContextRestored);

  return () => {
    canvas.removeEventListener("webglcontextlost", handleContextLost);
    canvas.removeEventListener("webglcontextrestored", handleContextRestored);
    boundCanvases.delete(canvas);
  };
}
