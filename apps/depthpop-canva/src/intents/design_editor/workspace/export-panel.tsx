import React from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  DepthPopExportRequest,
  DepthPopExportStatus,
  DepthPopApiClient,
} from "../api/depthpop-api";

export interface ExportPanelProps {
  apiClient?: DepthPopApiClient | null;
  exportFormat: DepthPopExportRequest["format"];
  setExportFormat: Dispatch<SetStateAction<DepthPopExportRequest["format"]>>;
  includeAnimation: boolean;
  setIncludeAnimation: Dispatch<SetStateAction<boolean>>;
  exportFps: number;
  setExportFps: Dispatch<SetStateAction<number>>;
  exportWidth: number;
  setExportWidth: Dispatch<SetStateAction<number>>;
  exportHeight: number;
  setExportHeight: Dispatch<SetStateAction<number>>;
  exportBusy: boolean;
  exportStatus: DepthPopExportStatus | null;
  startExport: () => Promise<void>;
  cancelExport: () => Promise<void>;
  downloadExport: () => Promise<void>;
}

export function ExportPanel({
  apiClient,
  exportFormat,
  setExportFormat,
  includeAnimation,
  setIncludeAnimation,
  exportFps,
  setExportFps,
  exportWidth,
  setExportWidth,
  exportHeight,
  setExportHeight,
  exportBusy,
  exportStatus,
  startExport,
  cancelExport,
  downloadExport,
}: ExportPanelProps) {
  return (
    <section className="dp-export-panel">
      <div className="dp-section-heading">
        <div>
          <span>DELIVERABLE</span>
          <h3>PRODUCTION EXPORT</h3>
        </div>
      </div>

      <label className="dp-field">
        FORMAT
        <select
          value={exportFormat}
          onChange={(event) =>
            setExportFormat(
              event.currentTarget.value as DepthPopExportRequest["format"],
            )
          }
        >
          <option value="scene-json">PORTABLE SCENE JSON</option>
          <option value="png-layers">PNG LAYERS ZIP</option>
          <option value="gltf">GLTF</option>
          <option value="glb">GLB</option>
          <option value="webm">WEBM</option>
          <option value="mp4">MP4</option>
        </select>
      </label>

      <label className="dp-check-field">
        <input
          type="checkbox"
          checked={includeAnimation}
          onChange={(event) => setIncludeAnimation(event.currentTarget.checked)}
        />
        INCLUDE AUTHORED ANIMATION
      </label>

      {(exportFormat === "mp4" || exportFormat === "webm") && (
        <div className="dp-video-settings">
          <label className="dp-field">
            VIDEO FPS
            <input
              type="number"
              min={1}
              max={60}
              value={exportFps}
              onChange={(event) =>
                setExportFps(
                  Math.max(1, Math.min(60, Number(event.currentTarget.value))),
                )
              }
            />
          </label>
          <label className="dp-field">
            WIDTH
            <input
              type="number"
              min={64}
              max={4096}
              step={16}
              value={exportWidth}
              onChange={(event) =>
                setExportWidth(
                  Math.max(
                    64,
                    Math.min(4096, Number(event.currentTarget.value)),
                  ),
                )
              }
            />
          </label>
          <label className="dp-field">
            HEIGHT
            <input
              type="number"
              min={64}
              max={4096}
              step={16}
              value={exportHeight}
              onChange={(event) =>
                setExportHeight(
                  Math.max(
                    64,
                    Math.min(4096, Number(event.currentTarget.value)),
                  ),
                )
              }
            />
          </label>
        </div>
      )}

      <button
        type="button"
        className="dp-exec"
        disabled={!apiClient || exportBusy}
        onClick={() => void startExport()}
      >
        {exportBusy ? "EXPORTING…" : "START EXPORT"}
      </button>

      {exportStatus && (
        <div className="dp-export-status" role="status">
          <div>
            <strong>{exportStatus.status.toUpperCase()}</strong>
            <span>{exportStatus.stage}</span>
          </div>
          <progress
            max={1}
            value={Math.max(0, Math.min(1, exportStatus.progress ?? 0))}
          />
          {exportStatus.error && (
            <p className="dp-error">{exportStatus.error}</p>
          )}
          <div className="dp-inline-actions">
            {(exportStatus.status === "queued" ||
              exportStatus.status === "processing") && (
              <button
                type="button"
                className="dp-btn-small"
                onClick={() => void cancelExport()}
              >
                CANCEL
              </button>
            )}
            {exportStatus.status === "complete" && exportStatus.downloadUrl && (
              <button
                type="button"
                className="dp-btn-small"
                onClick={() => void downloadExport()}
              >
                DOWNLOAD
              </button>
            )}
          </div>
        </div>
      )}

      <p className="dp-help">
        Scene JSON and PNG layers preserve project assets; glTF/GLB preserve
        spatial transforms and transform animation; WebM/MP4 render the authored
        timeline through the backend job system.
      </p>
    </section>
  );
}
