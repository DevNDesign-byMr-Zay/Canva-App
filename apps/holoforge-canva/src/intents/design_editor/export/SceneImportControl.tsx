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
  const [dragActive, setDragActive] = useState(false);

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
      setDragActive(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div
      className={
        "hf-scene-import" +
        (dragActive ? " is-dragging" : "")
      }
      onDragEnter={(event) => {
        event.preventDefault();
        if (!busy) setDragActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        if (!busy) setDragActive(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDragActive(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        if (!busy) void handleFile(event.dataTransfer.files?.[0]);
      }}
      aria-label="Open a HoloScene project"
    >
      <div>
        <span>HOLOSCENE PROJECT</span>
        <strong>{dragActive ? "Drop project to open" : "Resume an authored scene"}</strong>
        <small aria-live="polite">
          {message ?? "Open or drop a saved .holoscene.json project."}
        </small>
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
