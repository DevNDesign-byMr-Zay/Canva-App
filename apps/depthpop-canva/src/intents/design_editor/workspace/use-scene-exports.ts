import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  DepthPopApiClient,
  DepthPopExportRequest,
  DepthPopExportStatus,
} from "../api/depthpop-api";
import type { DepthScene } from "../scene/depth-scene";
import type { SceneAction } from "./scene-reducer";

export interface SceneExportOptions {
  apiClient?: DepthPopApiClient | null;
  scene: DepthScene;
  onSave?: (scene: DepthScene) => Promise<DepthScene>;
  dirty: boolean;
  dispatch: Dispatch<SceneAction>;
  exportFormat: DepthPopExportRequest["format"];
  includeAnimation: boolean;
  exportFps: number;
  exportWidth: number;
  exportHeight: number;
  setStatusMessage: Dispatch<SetStateAction<string | null>>;
}

function exportExtension(format: DepthPopExportRequest["format"]): string {
  if (format === "scene-json") return "depthscene.json";
  if (format === "png-layers") return "zip";
  return format;
}

export function useSceneExports({
  apiClient,
  scene,
  onSave,
  dirty,
  dispatch,
  exportFormat,
  includeAnimation,
  exportFps,
  exportWidth,
  exportHeight,
  setStatusMessage,
}: SceneExportOptions) {
  const [exportStatus, setExportStatus] = useState<DepthPopExportStatus | null>(
    null,
  );
  const [exportBusy, setExportBusy] = useState(false);

  const startExport = async () => {
    if (!apiClient) return;
    setExportBusy(true);
    setExportStatus(null);
    setStatusMessage(`Starting ${exportFormat} export…`);

    try {
      if (onSave && dirty) {
        const saved = await onSave(scene);
        dispatch({ type: "COMMIT_SCENE", scene: saved });
      }

      const created = await apiClient.createExportJob(scene.id, {
        format: exportFormat,
        includeAnimation,
        fps:
          exportFormat === "mp4" || exportFormat === "webm"
            ? exportFps
            : undefined,
        resolution:
          exportFormat === "mp4" || exportFormat === "webm"
            ? {
                width: exportWidth,
                height: exportHeight,
              }
            : undefined,
      });

      let current = await apiClient.getExportStatus(created.jobId);
      setExportStatus(current);
      while (current.status === "queued" || current.status === "processing") {
        await new Promise((resolve) => window.setTimeout(resolve, 700));
        current = await apiClient.getExportStatus(created.jobId);
        setExportStatus(current);
      }

      if (current.status === "complete") {
        setStatusMessage(`${exportFormat} export ready.`);
      } else if (current.status === "cancelled") {
        setStatusMessage("Export cancelled.");
      } else {
        setStatusMessage(current.error || "Export failed.");
      }
    } catch (cause) {
      setStatusMessage(
        cause instanceof Error ? cause.message : "Export failed.",
      );
    } finally {
      setExportBusy(false);
    }
  };

  const cancelExport = async () => {
    if (!apiClient || !exportStatus) return;
    try {
      const cancelled = await apiClient.cancelExportJob(exportStatus.jobId);
      setExportStatus(cancelled);
      setStatusMessage("Export cancellation requested.");
    } catch (cause) {
      setStatusMessage(
        cause instanceof Error ? cause.message : "Could not cancel export.",
      );
    }
  };

  const downloadExport = async () => {
    if (!apiClient || !exportStatus?.downloadUrl) return;
    try {
      const blob = await apiClient.downloadArtifactBlob(
        exportStatus.downloadUrl,
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `depthpop-${scene.id}.${exportExtension(exportFormat)}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setStatusMessage(
        cause instanceof Error ? cause.message : "Could not download export.",
      );
    }
  };

  return {
    exportStatus,
    exportBusy,
    startExport,
    cancelExport,
    downloadExport,
  };
}
