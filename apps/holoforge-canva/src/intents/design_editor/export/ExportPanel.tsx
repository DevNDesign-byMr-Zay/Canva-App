import React, { useMemo, useState } from "react";

import type { HoloScene } from "../scene/holo-scene";
import {
  backendOrigin,
  createBackendExport,
  downloadBackendExport,
  isWorkerExportImplemented,
  waitForExport,
} from "./export-client";
import {
  EXPORT_CAPABILITIES,
  buildExportRequest,
  capabilityFor,
  type HoloExportFormat,
} from "./export-contract";
import { downloadHoloScene } from "./scene-download";

const GROUPS = [
  {
    label: "AUTHORING",
    formats: ["scene-json"] as const,
  },
  {
    label: "3D",
    formats: ["glb", "gltf", "usdz"] as const,
  },
  {
    label: "RENDER",
    formats: ["webm-alpha", "mp4", "png-sequence"] as const,
  },
  {
    label: "DISPLAY",
    formats: ["lightfield-quilt"] as const,
  },
] as const;

export function ExportPanel({ scene }: { scene: HoloScene }) {
  const [format, setFormat] = useState<HoloExportFormat>("scene-json");
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const capability = capabilityFor(format);
  const backendConfigured = Boolean(backendOrigin());
  const workerImplemented =
    capability.execution === "render-worker" &&
    isWorkerExportImplemented(format);
  const actionable =
    capability.ready ||
    (workerImplemented && backendConfigured);

  const requestPreview = useMemo(() => {
    const request = buildExportRequest(scene, format);
    if (format === "lightfield-quilt" && request.quilt) {
      return (
        request.resolution.width +
        "×" +
        request.resolution.height +
        " · " +
        request.quilt.columns +
        "×" +
        request.quilt.rows +
        " · " +
        request.quilt.views +
        " VIEWS · " +
        request.quilt.viewConeDegrees +
        "°"
      );
    }
    return (
      request.resolution.width +
      "×" +
      request.resolution.height +
      (request.includeAnimation ? " · ANIMATION" : " · STATIC")
    );
  }, [format, scene]);

  const performExport = async () => {
    if (busy || !actionable) return;
    setStatus(null);
    setProgress(0);
    setBusy(true);

    try {
      if (capability.format === "scene-json") {
        downloadHoloScene(scene);
        setProgress(100);
        setStatus("HoloScene download prepared.");
        return;
      }

      const request = buildExportRequest(scene, format);
      setStatus("Materializing the HoloForge scene for the render backend…");
      setProgress(4);

      const created = await createBackendExport(scene, request);
      setStatus("Export queued.");
      setProgress(8);

      await waitForExport(created.jobId, (job) => {
        setProgress(job.percent);
        setStatus(job.message);
      });

      const fileName = await downloadBackendExport(created.exportId);
      setProgress(100);
      setStatus(fileName + " downloaded.");
    } catch (cause) {
      setStatus(
        cause instanceof Error
          ? cause.message
          : "HoloForge could not complete this export.",
      );
    } finally {
      setBusy(false);
    }
  };

  const availabilityLabel =
    capability.ready
      ? "READY"
      : workerImplemented
        ? backendConfigured
          ? "WORKER READY"
          : "BACKEND REQUIRED"
        : capability.execution === "device-adapter"
          ? "DEVICE ADAPTER"
          : "NOT IMPLEMENTED";

  return (
    <section className="hf-export-panel" aria-label="HoloForge export profiles">
      <div className="hf-export-head">
        <div>
          <span>05 · EXPORT / DEPLOY</span>
          <strong>{capability.label}</strong>
        </div>
        <b className={actionable ? "is-ready" : ""}>
          {availabilityLabel}
        </b>
      </div>

      <div className="hf-export-groups">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <span>{group.label}</span>
            <div>
              {group.formats.map((candidate) => {
                const option = capabilityFor(candidate);
                const implemented =
                  option.ready ||
                  (option.execution === "render-worker" &&
                    isWorkerExportImplemented(candidate));
                return (
                  <button
                    key={candidate}
                    type="button"
                    className={format === candidate ? "is-active" : ""}
                    onClick={() => {
                      setFormat(candidate);
                      setStatus(null);
                      setProgress(0);
                    }}
                  >
                    {option.label}
                    <i className={implemented ? "is-ready" : ""} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="hf-export-detail">
        <p>{capability.description}</p>
        <div>
          <span>{capability.extension}</span>
          <span>{requestPreview}</span>
          <span>{capability.execution.toUpperCase()}</span>
        </div>
      </div>

      <button
        type="button"
        className="hf-export-primary"
        disabled={!actionable || busy}
        onClick={() => void performExport()}
      >
        {busy
          ? "EXPORTING " + Math.round(progress) + "%"
          : capability.ready
            ? "DOWNLOAD " + capability.label.toUpperCase()
            : workerImplemented
              ? backendConfigured
                ? "RENDER " + capability.label.toUpperCase()
                : "CONFIGURE RENDER BACKEND"
              : capability.execution === "device-adapter"
                ? "DEVICE ADAPTER NOT IMPLEMENTED"
                : "FORMAT NOT IMPLEMENTED"}
      </button>

      {busy && (
        <div
          className="hf-export-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span style={{ width: Math.max(0, Math.min(100, progress)) + "%" }} />
        </div>
      )}

      {status && <p className="hf-export-status" aria-live="polite">{status}</p>}

      <p className="hf-export-boundary">
        Scene JSON is generated locally. GLB, glTF, transparent VP9 WebM, MP4,
        PNG sequences and multi-view quilt PNGs use the authenticated HoloForge
        render backend when configured. Quilt output is display-ready content,
        but optical interlacing still belongs to the connected display runtime.
        USDZ remains unavailable until its dedicated converter exists.
      </p>

      <span className="hf-export-count">
        {EXPORT_CAPABILITIES.length} FORMAT CONTRACTS · 1 CLIENT · 6 WORKER IMPLEMENTED
      </span>
    </section>
  );
}
