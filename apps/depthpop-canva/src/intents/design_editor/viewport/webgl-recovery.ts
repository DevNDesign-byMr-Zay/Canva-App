export interface WebGLRecoverySnapshot {
  sceneId: string;
  selectedObjectId: string | null;
  currentTimeMs: number;
  camera: {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
    fov: number;
  };
  wasPlaying: boolean;
}

export interface WebGLRecoveryOptions {
  onLost?: (snapshot: WebGLRecoverySnapshot) => void;
  onRestored?: (snapshot: WebGLRecoverySnapshot) => void;
}

interface BindingRecord {
  getSnapshot: () => WebGLRecoverySnapshot;
  options: WebGLRecoveryOptions;
  handleLost: (event: Event) => void;
  handleRestored: (event: Event) => void;
  refCount: number;
}

const canvasBindings = new WeakMap<HTMLCanvasElement, BindingRecord>();

export function bindWebGLRecovery(
  target: HTMLCanvasElement,
  getSnapshot: () => WebGLRecoverySnapshot,
  options: WebGLRecoveryOptions = {},
): () => void {
  let record = canvasBindings.get(target);

  if (!record) {
    const handleLost = (event: Event) => {
      event.preventDefault();
      const currentRecord = canvasBindings.get(target);
      if (currentRecord) {
        const snap = currentRecord.getSnapshot();
        currentRecord.options.onLost?.(snap);
      }
    };

    const handleRestored = (_event: Event) => {
      const currentRecord = canvasBindings.get(target);
      if (currentRecord) {
        const snap = currentRecord.getSnapshot();
        currentRecord.options.onRestored?.(snap);
      }
    };

    record = {
      getSnapshot,
      options,
      handleLost,
      handleRestored,
      refCount: 1,
    };

    target.addEventListener("webglcontextlost", handleLost);
    target.addEventListener("webglcontextrestored", handleRestored);
    canvasBindings.set(target, record);
  } else {
    record.getSnapshot = getSnapshot;
    record.options = options;
    record.refCount += 1;
  }

  return () => {
    const current = canvasBindings.get(target);
    if (!current) return;

    current.refCount -= 1;
    if (current.refCount <= 0) {
      target.removeEventListener("webglcontextlost", current.handleLost);
      target.removeEventListener(
        "webglcontextrestored",
        current.handleRestored,
      );
      canvasBindings.delete(target);
    }
  };
}
