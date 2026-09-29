import { Alert, Text, Title } from "@canva/app-ui-kit";
import { useFeatureSupport } from "@canva/app-hooks";
import { openDesign } from "@canva/design";
import { FormattedMessage, useIntl } from "react-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  applyScenario,
  canApplyScenario,
  readCurrentDesignSnapshot,
  type ApplyVerificationReceipt,
  type CanvaDesignSnapshot,
} from "./canva-design";
import { createApplyAttestation, type ApplyAttestation } from "./apply-attestation";
import { createApplyRunGate } from "./apply-run-gate";
import {
  createReviewedApplyContext,
  isApplyProofCurrentForReview,
  isReviewedApplyContextCurrent,
} from "./review-context-guard";
import { buildScenarioReview } from "./scenario-review";
import { snapshotScenarioForPresentation } from "./scenario-contract";
import { buildSpatialPreviewModel, type SpatialPreviewModel } from "./spatial-preview";

import { StudioTabs, type StudioTab } from "./navigation/studio-tabs";
import { ProductSwitcher, type ProductSurface } from "./navigation/product-switcher";
import { CreatePanel } from "./create/create-panel";
import { SpatialPanel } from "./spatial/spatial-panel";
import { VerifyPanel } from "./verify/verify-panel";
import { DepthPopPanel } from "./depthpop/depthpop-panel";
import type { HolographicEffectPlan } from "./holographic/effect-plan";
import { executeHolographicEffectPlan } from "./holographic/effect-executor";
import { canvaAppOwnedEffectAdapter } from "./holographic/app-owned-effect-adapter";

import "./app.css";

export type AppScenario = Parameters<typeof canApplyScenario>[0];

export type AppProps = {
  scenario?: AppScenario;
  /** Design ID returned by the trusted backend/token verification seam. */
  trustedDesignId?: string;
  /** Optional current page ID returned by the same trusted review-target seam. */
  trustedPageId?: string;
  /** Initial product when one compiled bundle is used for local review. */
  initialProduct?: ProductSurface;
  /** Locks a packaged bundle to one Canva product surface. */
  lockedProduct?: ProductSurface | null;
};

type AppStatus = "idle" | "reading" | "applying" | "done" | "warning" | "error";

export function App({
  scenario = null,
  trustedDesignId,
  trustedPageId,
  initialProduct = "holoforge",
  lockedProduct = null,
}: AppProps) {
  const intl = useIntl();
  const isSupported = useFeatureSupport();
  const designEditingSupported = isSupported(openDesign);

  const [selectedProduct, setSelectedProduct] = useState<ProductSurface>(initialProduct);
  const activeProduct = lockedProduct ?? selectedProduct;
  const [activeTab, setActiveTab] = useState<StudioTab>("create");
  const [snapshot, setSnapshot] = useState<CanvaDesignSnapshot | null>(null);
  const [status, setStatus] = useState<AppStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [scenarioVerified, setScenarioVerified] = useState(false);
  const [receipt, setReceipt] = useState<ApplyVerificationReceipt | null>(null);
  const [attestation, setAttestation] = useState<ApplyAttestation | null>(null);
  const [effectPlan, setEffectPlan] = useState<HolographicEffectPlan | null>(null);
  const [isForging, setIsForging] = useState(false);
  const [selectedSpatialElementId, setSelectedSpatialElementId] = useState<string | null>(null);

  const applyRunGate = useRef(createApplyRunGate());
  const reviewScenario = useMemo(
    () => (scenario ? snapshotScenarioForPresentation(scenario) : null),
    [scenario],
  );
  const latestReviewContext = useRef<{
    scenario: NonNullable<AppScenario>;
    snapshot: CanvaDesignSnapshot;
    trustedDesignId?: string;
    trustedPageId?: string;
  } | null>(null);

  const refresh = useCallback(async () => {
    setStatus("reading");
    setMessage(null);
    setScenarioVerified(false);
    setReceipt(null);
    setAttestation(null);

    try {
      setSnapshot(await readCurrentDesignSnapshot({ trustedDesignId }));
      setStatus("idle");
    } catch (error) {
      setSnapshot(null);
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : intl.formatMessage({
              defaultMessage: "We couldn't read the current Canva design.",
              description: "Error shown when HoloForge cannot read the current Canva design.",
            }),
      );
    }
  }, [intl, trustedDesignId]);

  useEffect(() => {
    latestReviewContext.current =
      reviewScenario && snapshot
        ? { scenario: reviewScenario, snapshot, trustedDesignId, trustedPageId }
        : null;
  }, [reviewScenario, snapshot, trustedDesignId, trustedPageId]);

  useEffect(() => {
    if (!receipt || !attestation) return;
    if (
      isApplyProofCurrentForReview(attestation, {
        scenario: reviewScenario,
        trustedDesignId,
        trustedPageId,
      })
    ) {
      return;
    }

    setReceipt(null);
    setAttestation(null);
    if (status === "done" || status === "warning") {
      setStatus("idle");
      setMessage(null);
    }
  }, [attestation, receipt, reviewScenario, status, trustedDesignId, trustedPageId]);

  useEffect(() => {
    let cancelled = false;
    setScenarioVerified(false);
    const normalizedTrustedDesignId = trustedDesignId?.trim();
    const normalizedTrustedPageId = trustedPageId?.trim();
    if (
      !reviewScenario ||
      !snapshot ||
      !designEditingSupported ||
      (normalizedTrustedDesignId && snapshot.designId !== normalizedTrustedDesignId) ||
      (normalizedTrustedPageId && snapshot.pageId !== normalizedTrustedPageId)
    ) {
      return () => {
        cancelled = true;
      };
    }

    void canApplyScenario(reviewScenario, snapshot).then((safe) => {
      if (!cancelled) setScenarioVerified(safe);
    });

    return () => {
      cancelled = true;
    };
  }, [designEditingSupported, reviewScenario, snapshot, trustedDesignId, trustedPageId]);

  const review = useMemo(
    () => (reviewScenario && snapshot ? buildScenarioReview(reviewScenario, snapshot) : []),
    [reviewScenario, snapshot],
  );

  const spatialModel: SpatialPreviewModel | null = useMemo(() => {
    if (!reviewScenario || !snapshot || !scenarioVerified) return null;
    try {
      return buildSpatialPreviewModel(reviewScenario, snapshot);
    } catch {
      return null;
    }
  }, [reviewScenario, scenarioVerified, snapshot]);

  const readyToApply = designEditingSupported && scenarioVerified;

  const apply = useCallback(async () => {
    if (!reviewScenario || !snapshot || !readyToApply) return;
    const runToken = applyRunGate.current.tryAcquire();
    if (runToken === null) return;

    setStatus("applying");
    setMessage(null);
    setReceipt(null);
    setAttestation(null);

    try {
      const reviewedSnapshot = snapshot;
      const reviewedContext = createReviewedApplyContext({
        scenario: reviewScenario,
        snapshot: reviewedSnapshot,
        trustedDesignId,
        trustedPageId,
      });
      const result = await applyScenario(reviewScenario, reviewedSnapshot);
      const sealedAttestation = await createApplyAttestation({
        scenario: reviewScenario,
        snapshot: reviewedSnapshot,
        receipt: result,
      });
      const currentReviewContext = latestReviewContext.current;

      if (
        !currentReviewContext ||
        !isReviewedApplyContextCurrent(reviewedContext, currentReviewContext)
      ) {
        setStatus("error");
        setScenarioVerified(false);
        setReceipt(null);
        setAttestation(null);
        setMessage(
          intl.formatMessage({
            defaultMessage:
              "The selected review changed while Apply was running. The original design change was verified, but its result is hidden until you read the current design again.",
            description:
              "Safety message shown when the reviewed Canva scenario changes during an in-flight apply.",
          }),
        );
        try {
          setSnapshot(await readCurrentDesignSnapshot({ trustedDesignId }));
        } catch {
          setSnapshot(null);
        }
        return;
      }

      setReceipt(result);
      setAttestation(sealedAttestation);
      setScenarioVerified(false);
      setStatus("done");
      setMessage(
        intl.formatMessage(
          {
            defaultMessage:
              "Applied {count, number} selected change(s), verified the Canva post-state, and sealed the reviewed apply attestation.",
            description: "Confirmation after a verified HoloForge Apply.",
          },
          { count: result.changedElementIds.length },
        ),
      );

      try {
        setSnapshot(await readCurrentDesignSnapshot({ trustedDesignId }));
      } catch {
        setSnapshot(null);
        setStatus("warning");
      }
    } catch (error) {
      setStatus("error");
      setScenarioVerified(false);
      setReceipt(null);
      setAttestation(null);
      setMessage(
        error instanceof Error
          ? error.message
          : intl.formatMessage({
              defaultMessage: "The selected scenario could not be applied.",
              description: "Error shown when a selected HoloForge scenario fails to apply.",
            }),
      );
    } finally {
      applyRunGate.current.release(runToken);
    }
  }, [intl, readyToApply, reviewScenario, snapshot, trustedDesignId, trustedPageId]);

  const previewHologram = useCallback(
    (plan: HolographicEffectPlan) => {
      setEffectPlan(plan);
      setMessage(
        intl.formatMessage(
          {
            defaultMessage:
              "Previewing {preset}. Spatial depth and motion are presentation-only until Canva exposes a compatible write surface.",
            description: "Message shown after building a holographic material preview.",
          },
          { preset: plan.presetName },
        ),
      );
      setStatus("idle");
      setActiveTab("spatial");
    },
    [intl],
  );

  const forgeIntoCanva = useCallback(
    async (plan: HolographicEffectPlan) => {
      if (!designEditingSupported) {
        setStatus("error");
        setMessage(
          intl.formatMessage({
            defaultMessage: "Design editing isn't supported in this Canva context.",
            description:
              "Error shown when a HoloForge effect cannot be forged in the current context.",
          }),
        );
        return;
      }

      setIsForging(true);
      setStatus("applying");
      setMessage(null);
      try {
        const result = await executeHolographicEffectPlan(plan, canvaAppOwnedEffectAdapter);
        setEffectPlan(plan);
        setStatus("done");
        setMessage(
          intl.formatMessage(
            {
              defaultMessage:
                "Forged {preset} into Canva as an editable HoloForge app element. Preview-only properties: {previewOnly}.",
              description:
                "Confirmation after creating a real HoloForge app-owned element in Canva.",
            },
            {
              preset: plan.presetName,
              previewOnly: result.previewOnlyProperties.length
                ? result.previewOnlyProperties.join(", ")
                : "none",
            },
          ),
        );
        try {
          setSnapshot(await readCurrentDesignSnapshot({ trustedDesignId }));
        } catch {
          // The app element itself was created; a snapshot refresh is supplemental.
        }
      } catch (error) {
        setStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : intl.formatMessage({
                defaultMessage: "HoloForge couldn't create this holographic effect in Canva.",
                description: "Fallback error for holographic effect creation.",
              }),
        );
      } finally {
        setIsForging(false);
      }
    },
    [designEditingSupported, intl, trustedDesignId],
  );

  const messageTone = status === "error" ? "critical" : status === "warning" ? "warn" : "positive";

  return (
    <div className="canva-tool-shell">
      {!lockedProduct && (
        <ProductSwitcher activeProduct={activeProduct} onSelectProduct={setSelectedProduct} />
      )}

      {activeProduct === "depthpop" ? (
        <DepthPopPanel snapshot={snapshot} isReading={status === "reading"} onRefresh={refresh} />
      ) : (
        <div className="hf-shell">
          <header className="hf-hero">
            <div className="hf-brand-row">
              <div className="hf-brand-lockup">
                <span className="hf-mark" aria-hidden="true" />
                <div>
                  <div className="hf-kicker">HOLOGRAPHIC DESIGN STUDIO</div>
                  <div className="hf-title-wrap">
                    <Title>
                      <FormattedMessage
                        defaultMessage="HoloForge"
                        description="Name of the HoloForge Canva app."
                      />
                    </Title>
                  </div>
                </div>
              </div>
              <span className="hf-trust-pill">CANVA</span>
            </div>
            <div className="hf-hero-copy">
              <Text>
                <FormattedMessage
                  defaultMessage="Create holographic materials, preview them spatially, then apply supported changes with verification."
                  description="Short purpose statement for HoloForge."
                />
              </Text>
            </div>
          </header>

          <StudioTabs activeTab={activeTab} onSelectTab={setActiveTab} />

          {!designEditingSupported && (
            <Alert tone="warn">
              <FormattedMessage
                defaultMessage="Design editing isn't supported in this Canva context. Holographic preview remains available, but Forge and Verify writes stay locked."
                description="Capability warning when Canva does not support design editing."
              />
            </Alert>
          )}
          {message && <Alert tone={messageTone}>{message}</Alert>}

          {activeTab === "create" && (
            <CreatePanel
              onPreviewHologram={previewHologram}
              onForgeIntoCanva={forgeIntoCanva}
              isForging={isForging}
            />
          )}
          {activeTab === "spatial" && (
            <SpatialPanel
              spatialModel={spatialModel}
              effectPlan={effectPlan}
              selectedElementId={selectedSpatialElementId}
              onSelectElement={setSelectedSpatialElementId}
            />
          )}
          {activeTab === "verify" && (
            <VerifyPanel
              snapshot={snapshot}
              reviewScenario={reviewScenario}
              review={review}
              scenarioVerified={scenarioVerified}
              readyToApply={readyToApply}
              isReading={status === "reading"}
              isApplying={status === "applying"}
              receipt={receipt}
              attestation={attestation}
              onRefresh={refresh}
              onApply={apply}
            />
          )}
        </div>
      )}
    </div>
  );
}
