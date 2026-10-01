import React, { useMemo, useState } from "react";

import type { HoloScene } from "../scene/holo-scene";
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
  const capability = capabilityFor(format);

  const requestPreview = useMemo(() => {
    if (format === "lightfield-quilt") {
      return "DEVICE PROFILE REQUIRED";
    }
    const request = buildExportRequest(scene, format);
    return (
      request.resolution.width +
      "×" +
      request.resolution.height +
      (request.includeAnimation ? " · ANIMATION" : " · STATIC")
    );
  }, [format, scene]);

  const performExport = () => {
    setStatus(null);
    if (!capability.ready || capability.execution !== "client") return;

    try {
      if (capability.format === "scene-json") {
        downloadHoloScene(scene);
        setStatus("HoloScene download prepared.");
      }
    } catch (cause) {
      setStatus(
        cause instanceof Error
          ? cause.message
          : "The browser could not prepare the HoloForge download.",
      );
    }
  };

  return (
    <section className="hf-export-panel" aria-label="HoloForge export profiles">
      <div className="hf-export-head">
        <div>
          <span>05 · EXPORT / DEPLOY</span>
          <strong>{capability.label}</strong>
        </div>
        <b className={capability.ready ? "is-ready" : ""}>
          {capability.ready
            ? "READY"
            : capability.execution === "device-adapter"
              ? "DEVICE ADAPTER"
              : "RENDER WORKER"}
        </b>
      </div>

      <div className="hf-export-groups">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <span>{group.label}</span>
            <div>
              {group.formats.map((candidate) => {
                const option = capabilityFor(candidate);
                return (
                  <button
                    key={candidate}
                    type="button"
                    className={format === candidate ? "is-active" : ""}
                    onClick={() => {
                      setFormat(candidate);
                      setStatus(null);
                    }}
                  >
                    {option.label}
                    <i className={option.ready ? "is-ready" : ""} />
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

      {capability.ready ? (
        <button type="button" className="hf-export-primary" onClick={performExport}>
          DOWNLOAD {capability.label.toUpperCase()}
        </button>
      ) : (
        <button type="button" className="hf-export-primary" disabled>
          {capability.execution === "device-adapter"
            ? "SELECT DEVICE PROFILE IN RENDER WORKER"
            : "RENDER WORKER REQUIRED"}
        </button>
      )}

      {status && <p className="hf-export-status" aria-live="polite">{status}</p>}

      <p className="hf-export-boundary">
        HoloForge only marks an export READY when this runtime can produce the actual file.
        Worker/device formats stay visible and selectable for planning, but cannot masquerade as finished downloads.
      </p>

      <span className="hf-export-count">
        {EXPORT_CAPABILITIES.length} FORMAT CONTRACTS · 1 CLIENT-READY
      </span>
    </section>
  );
}
