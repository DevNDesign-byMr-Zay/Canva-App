import React, { useRef, useState } from "react";

import type { HoloScene } from "../scene/holo-scene";
import { readHoloSceneFile } from "./scene-import";

export function SceneImportControl({
  onImported,
}: {
  onImported: (scene: HoloScene, fileName: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    setMessage(null);

    try {
      const scene = await readHoloSceneFile(file);
      onImported(scene, file.name);
      setMessage(
        scene.objects.length +
          " object" +
          (scene.objects.length === 1 ? "" : "s") +
          " restored · " +
          scene.id,
      );
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "HoloForge could not open this HoloScene.",
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="hf-scene-import">
      <div>
        <span>HOLOSCENE PROJECT</span>
        <strong>Resume an authored scene</strong>
        {message && <small aria-live="polite">{message}</small>}
      </div>
      <label className={busy ? "is-busy" : ""}>
        {busy ? "OPENING…" : "OPEN"}
        <input
          ref={input}
          type="file"
          accept=".json,.holoscene,application/json"
          disabled={busy}
          onChange={(event) => void handleFile(event.currentTarget.files?.[0])}
        />
      </label>
    </div>
  );
}
