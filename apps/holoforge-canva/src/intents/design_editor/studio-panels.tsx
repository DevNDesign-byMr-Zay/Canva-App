import React from "react";
import type { HolographicEffectPlan } from "./holographic/effect-plan";
import type { HolographicExecutionResult } from "./holographic/effect-executor";
import type { HoloScene as HoloSceneSpec } from "./scene/holo-scene";
import { HoloViewport } from "./viewport/HoloViewport";

export function SpatialPreview({
  plan,
  scene,
  onSceneChange,
}: {
  plan: HolographicEffectPlan | null;
  scene: HoloSceneSpec | null;
  onSceneChange: (scene: HoloSceneSpec) => void;
}) {
  if (!scene) {
    return (
      <div className="hf-empty-state">
        <span className="hf-empty-orb" />
        <strong>No hologram staged yet</strong>
        <p>
          Build a material in CREATE, then preview it in the real WebGL studio
          before forging it into Canva.
        </p>
      </div>
    );
  }

  const firstObject = scene.objects[0] ?? null;
  const p = plan?.parameters;

  return (
    <div className="hf-spatial-panel">
      <HoloViewport scene={scene} onSceneChange={onSceneChange} />

      <div className="hf-preview-meta">
        <div>
          <span>ACTIVE MATERIAL</span>
          <strong>
            {plan?.presetName ??
              (firstObject
                ? firstObject.material.family.toUpperCase() + " · RESTORED"
                : "RESTORED SCENE")}
          </strong>
        </div>
        <div>
          <span>SCENE</span>
          <strong>WEBGL · X/Y/Z + TIME</strong>
        </div>
      </div>

      <div className="hf-metric-grid">
        <div>
          <span>Shift</span>
          <strong>
            {Math.round(
              p?.colorShift ?? firstObject?.material.spectralShift ?? 0,
            )}
            %
          </strong>
        </div>
        <div>
          <span>{p ? "Depth" : "Thickness"}</span>
          <strong>
            {p
              ? Math.round(p.depth) + "%"
              : (firstObject?.geometry.thickness ?? 0).toFixed(2)}
          </strong>
        </div>
        <div>
          <span>Reflect</span>
          <strong>
            {Math.round(
              p?.reflection ?? firstObject?.material.reflectionStrength ?? 0,
            )}
            %
          </strong>
        </div>
        <div>
          <span>Glow</span>
          <strong>
            {p
              ? Math.round(p.glow) + "%"
              : (firstObject?.material.emissionStrength ?? 0).toFixed(2)}
          </strong>
        </div>
      </div>

      <p className="hf-boundary-copy">
        This SPATIAL view is a real Three.js scene inside the Canva app iframe.
        Orbit, pan, zoom, object selection, transform controls, playback and
        timeline scrubbing operate on the same HoloScene contract used by the
        authenticated render backend. Transparent source silhouettes are
        extruded in-browser and in Blender exports. Authored transforms,
        keyframes and timeline state stay in the active studio session when you
        move between tabs. GLB, glTF, USDZ, MP4, transparent WebM, PNG sequence
        and light-field quilt output become available when the production render
        backend is configured. Exported HoloScene JSON can also be reopened
        here, restoring the authored objects, camera, environment, timeline and
        keyframes.
      </p>
    </div>
  );
}

export function VerifyPanel({
  plan,
  result,
  error,
}: {
  plan: HolographicEffectPlan | null;
  result: HolographicExecutionResult | null;
  error: string | null;
}) {
  return (
    <div className="hf-verify-panel">
      <div className={"hf-proof-ring " + (result ? "is-sealed" : "")}>
        <span>{result ? "✓" : "◇"}</span>
      </div>
      <div className="hf-proof-copy">
        <span className="hf-section-kicker">FORGE RECEIPT</span>
        <h2>
          {result
            ? result.route === "DERIVED_IMAGE"
              ? "HOLOGRAPHIC IMAGE CREATED"
              : "CANVA ELEMENT CREATED"
            : "AWAITING FORGE"}
        </h2>
        <p>
          {result
            ? result.route === "DERIVED_IMAGE"
              ? "HoloForge transformed the bound raster into a derived Canva asset and inserted the forged holographic treatment into the design."
              : "HoloForge created an editable app-owned holographic design element in Canva."
            : "Forge a material to create a real Canva output and seal this receipt."}
        </p>
      </div>
      {plan && (
        <div className="hf-receipt">
          <div>
            <span>Preset</span>
            <strong>{plan.presetName}</strong>
          </div>
          <div>
            <span>Creation</span>
            <strong>
              {plan.creationType.replaceAll("_", " ").toUpperCase()}
            </strong>
          </div>
          <div>
            <span>Plan</span>
            <strong>{plan.isValid ? "VALID" : "INVALID"}</strong>
          </div>
          <div>
            <span>Route</span>
            <strong>{result?.route ?? "NOT EXECUTED"}</strong>
          </div>
        </div>
      )}
      {result && result.previewOnlyProperties.length > 0 && (
        <p className="hf-boundary-copy">
          Preview-only behavior: {result.previewOnlyProperties.join(", ")}.
        </p>
      )}
      {error && <div className="hf-error">{error}</div>}
    </div>
  );
}

