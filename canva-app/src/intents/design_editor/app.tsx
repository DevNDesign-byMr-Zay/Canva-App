import { Alert, Button, Rows, Text, Title } from "@canva/app-ui-kit";
import { useFeatureSupport } from "@canva/app-hooks";
import { openDesign } from "@canva/design";
import { FormattedMessage, useIntl } from "react-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import "./app.css";

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

export type AppScenario = Parameters<typeof canApplyScenario>[0];

type AppProps = {
  scenario?: AppScenario;
  /** Design ID returned by the trusted backend/token verification seam. */
  trustedDesignId?: string;
  /** Optional current page ID returned by the same trusted review-target seam. */
  trustedPageId?: string;
};

type AppStatus = "idle" | "reading" | "applying" | "done" | "warning" | "error";

export function App({ scenario = null, trustedDesignId, trustedPageId }: AppProps) {
  const intl = useIntl();
  const isSupported = useFeatureSupport();
  const designEditingSupported = isSupported(openDesign);
  const [snapshot, setSnapshot] = useState<CanvaDesignSnapshot | null>(null);
  const [status, setStatus] = useState<AppStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [scenarioVerified, setScenarioVerified] = useState(false);
  const [receipt, setReceipt] = useState<ApplyVerificationReceipt | null>(null);
  const [attestation, setAttestation] = useState<ApplyAttestation | null>(null);
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

  const refreshLabel = intl.formatMessage({
    defaultMessage: "Read current design",
    description: "Button that captures the current Canva design snapshot for scenario comparison.",
  });
  const applyLabel = intl.formatMessage({
    defaultMessage: "Apply selected scenario",
    description: "Explicit action to apply the selected HoloForge scenario to the Canva design.",
  });

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
          setMessage(
            intl.formatMessage({
              defaultMessage:
                "The selected review changed while Apply was running. The original design change was verified but its result remains hidden, and the current design could not be refreshed. Read the current design before reviewing another Apply.",
              description:
                "Safety message shown when review context changes during Apply and the follow-up design refresh also fails.",
            }),
          );
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
            description:
              "Confirmation after applying, verifying, and attesting one selected HoloForge scenario in Canva.",
          },
          { count: result.changedElementIds.length },
        ),
      );

      try {
        setSnapshot(await readCurrentDesignSnapshot({ trustedDesignId }));
      } catch {
        setSnapshot(null);
        setStatus("warning");
        setMessage(
          intl.formatMessage(
            {
              defaultMessage:
                "The selected changes were applied, verified, and attested for design {designId}, page {pageId}, but HoloForge could not refresh the current design afterward. The proof below remains bound to that reviewed target and does not describe unseen current state. Read the current design before applying another scenario.",
              description:
                "Warning shown after a successful verified Apply when the follow-up Canva design refresh fails, identifying the exact reviewed proof target.",
            },
            {
              designId: sealedAttestation.designId,
              pageId: sealedAttestation.pageId,
            },
          ),
        );
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

  const messageTone = status === "error" ? "critical" : status === "warning" ? "warn" : "positive";

  return (
    <div className="hf-shell">
      <Rows spacing="2u">
        <section className="hf-hero" aria-labelledby="holoforge-title">
          <div className="hf-brand-row">
            <div className="hf-brand-lockup">
              <div className="hf-mark" aria-hidden="true">
                HF
              </div>
              <div>
                <div className="hf-kicker">
                  <FormattedMessage
                    defaultMessage="HoloForge · Design Editor"
                    description="Compact product label for the HoloForge Canva Design Editor experience."
                  />
                </div>
                <div id="holoforge-title" className="hf-title-wrap">
                  <Title>
                    <FormattedMessage
                      defaultMessage="HoloForge"
                      description="Name of the HoloForge Canva app."
                    />
                  </Title>
                </div>
              </div>
            </div>
            <span className="hf-trust-pill">
              <FormattedMessage
                defaultMessage="Evidence-backed"
                description="Trust label explaining that HoloForge reviews use verified scenario evidence."
              />
            </span>
          </div>

          <div className="hf-hero-copy">
            <Text>
              <FormattedMessage
                defaultMessage="Review verified design changes before anything touches the canvas."
                description="Short production-facing description of the HoloForge review workflow."
              />
            </Text>
          </div>

          <div className="hf-stage-rail" aria-label="HoloForge review workflow">
            <div
              className={`hf-stage ${snapshot ? "is-complete" : status === "reading" ? "is-active" : ""}`}
            >
              <span className="hf-stage-number">01</span>
              <span className="hf-stage-label">
                <FormattedMessage
                  defaultMessage="Read"
                  description="Workflow stage for reading the current Canva design."
                />
              </span>
            </div>
            <div
              className={`hf-stage ${
                receipt && attestation
                  ? "is-complete"
                  : reviewScenario && snapshot
                    ? "is-active"
                    : ""
              }`}
            >
              <span className="hf-stage-number">02</span>
              <span className="hf-stage-label">
                <FormattedMessage
                  defaultMessage="Review"
                  description="Workflow stage for reviewing a scenario against the current design."
                />
              </span>
            </div>
            <div
              className={`hf-stage ${
                receipt && attestation
                  ? "is-complete"
                  : readyToApply || status === "applying"
                    ? "is-active"
                    : ""
              }`}
            >
              <span className="hf-stage-number">03</span>
              <span className="hf-stage-label">
                <FormattedMessage
                  defaultMessage="Apply"
                  description="Workflow stage for explicitly applying a verified scenario."
                />
              </span>
            </div>
          </div>
        </section>

        {!designEditingSupported && (
          <Alert tone="warn">
            <FormattedMessage
              defaultMessage="Design editing isn't supported in this Canva context. Preview remains read-only."
              description="Capability warning when Canva does not support design editing in the current context."
            />
          </Alert>
        )}

        {message && <Alert tone={messageTone}>{message}</Alert>}

        <section className="hf-card" aria-labelledby="snapshot-title">
          <div className="hf-card-header">
            <div>
              <div className="hf-card-eyebrow">
                <FormattedMessage
                  defaultMessage="01 · Current design"
                  description="Label for the first HoloForge workflow card."
                />
              </div>
              <div id="snapshot-title">
                <Title>
                  <FormattedMessage
                    defaultMessage="Design snapshot"
                    description="Heading for the current Canva design snapshot card."
                  />
                </Title>
              </div>
            </div>
            <span className={`hf-state-pill ${snapshot ? "is-ready" : "is-locked"}`}>
              {snapshot ? (
                <FormattedMessage
                  defaultMessage="Ready"
                  description="State label shown when the current design snapshot is available."
                />
              ) : status === "reading" ? (
                <FormattedMessage
                  defaultMessage="Reading"
                  description="State label shown while HoloForge reads the current Canva design."
                />
              ) : (
                <FormattedMessage
                  defaultMessage="Required"
                  description="State label shown before the current design snapshot has been captured."
                />
              )}
            </span>
          </div>

          <div className="hf-card-copy">
            <Text>
              <FormattedMessage
                defaultMessage="Capture the live design state used for stale-review protection and verified Apply."
                description="Explains why HoloForge reads the current design before review."
              />
            </Text>
          </div>

          <div className="hf-card-actions">
            <Button
              variant="secondary"
              onClick={refresh}
              loading={status === "reading"}
              disabled={status === "applying"}
              stretch
            >
              {refreshLabel}
            </Button>
          </div>

          {snapshot ? (
            <div className="hf-snapshot-meta">
              <div className="hf-metric">
                <span className="hf-metric-value">{snapshot.elements.length}</span>
                <span className="hf-metric-label">
                  <FormattedMessage
                    defaultMessage="Elements"
                    description="Label for the number of elements captured in the design snapshot."
                  />
                </span>
              </div>
              <div className="hf-fingerprint">
                <span className="hf-data-label">
                  <FormattedMessage
                    defaultMessage="Snapshot fingerprint"
                    description="Label for the immutable current-design snapshot fingerprint."
                  />
                </span>
                <span className="hf-code">{`${snapshot.fingerprint.slice(0, 18)}…`}</span>
              </div>
            </div>
          ) : (
            <div className="hf-empty">
              <Text>
                <FormattedMessage
                  defaultMessage="No snapshot yet. Read the current design before reviewing a candidate."
                  description="Compact empty state before the current Canva design has been read."
                />
              </Text>
            </div>
          )}
        </section>

        {reviewScenario ? (
          <section className="hf-card" aria-labelledby="review-title">
            <div className="hf-card-header">
              <div>
                <div className="hf-card-eyebrow">
                  <FormattedMessage
                    defaultMessage="02 · Scenario review"
                    description="Label for the second HoloForge workflow card."
                  />
                </div>
                <div id="review-title">
                  <Title>
                    <FormattedMessage
                      defaultMessage="Review changes"
                      description="Heading for HoloForge scenario change review."
                    />
                  </Title>
                </div>
              </div>
              <span className={`hf-state-pill ${scenarioVerified ? "is-ready" : "is-locked"}`}>
                {scenarioVerified ? (
                  <FormattedMessage
                    defaultMessage="Verified"
                    description="State label shown when a HoloForge scenario is safe to apply."
                  />
                ) : (
                  <FormattedMessage
                    defaultMessage="Checking"
                    description="State label shown while a HoloForge scenario is awaiting verification."
                  />
                )}
              </span>
            </div>

            <div className="hf-card-copy">
              <span className="hf-data-label">
                <FormattedMessage
                  defaultMessage="Scenario"
                  description="Label for the selected HoloForge scenario identifier."
                />
              </span>
              <span className="hf-code">{reviewScenario.scenarioId}</span>
            </div>

            {snapshot ? (
              <>
                <div className="hf-change-list">
                  {review.map(({ elementId, before, after, changedFields }) => (
                    <article className="hf-change-item" key={elementId}>
                      <div className="hf-change-topline">
                        <span className="hf-change-id">{elementId}</span>
                        <span className="hf-field-pill">{changedFields.join(" · ")}</span>
                      </div>
                      <div className="hf-change-values">
                        <span>
                          {before.left}×{before.top} · {before.width}×{before.height}
                        </span>
                        <span className="hf-arrow">↓</span>
                        <span>
                          {after.left}×{after.top} · {after.width}×{after.height}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>

                {review.length === 0 && (
                  <div className="hf-empty">
                    <Text>
                      <FormattedMessage
                        defaultMessage="No reviewable Canva element mapping was found for this candidate."
                        description="Explains an empty candidate projection without inventing a mapping."
                      />
                    </Text>
                  </div>
                )}
              </>
            ) : (
              <div className="hf-empty">
                <Text>
                  <FormattedMessage
                    defaultMessage="Capture the current design to unlock a verified element-by-element review."
                    description="Explains that a snapshot is needed before HoloForge can show a scenario review."
                  />
                </Text>
              </div>
            )}

            <div className="hf-apply-zone">
              <Button
                variant="primary"
                onClick={apply}
                loading={status === "applying"}
                disabled={!readyToApply || status === "reading"}
                stretch
              >
                {applyLabel}
              </Button>
              {!readyToApply && (
                <div className="hf-lock-note">
                  <Text>
                    <FormattedMessage
                      defaultMessage="Apply stays locked until scenario provenance and the current Canva snapshot are verified."
                      description="Explains why HoloForge keeps the apply action disabled."
                    />
                  </Text>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="hf-card" aria-labelledby="waiting-title">
            <div className="hf-card-eyebrow">
              <FormattedMessage
                defaultMessage="02 · Scenario review"
                description="Label for the second HoloForge workflow card while waiting for a scenario."
              />
            </div>
            <div id="waiting-title">
              <Title>
                <FormattedMessage
                  defaultMessage="Waiting for a candidate"
                  description="Heading shown while HoloForge waits for an upstream scenario."
                />
              </Title>
            </div>
            <div className="hf-card-copy">
              <Alert tone="info">
                <FormattedMessage
                  defaultMessage="HoloForge will not invent a layout or silently change your design. An evidence-backed candidate must arrive from the trusted upstream workflow."
                  description="Explains that scenario generation happens upstream and HoloForge is not an autonomous solver."
                />
              </Alert>
            </div>
          </section>
        )}

        {receipt && attestation && (
          <section className="hf-proof-card" aria-labelledby="proof-title">
            <div className="hf-proof-topline">
              <div>
                <div className="hf-card-eyebrow">
                  <FormattedMessage
                    defaultMessage="03 · Verified result"
                    description="Label for the third HoloForge workflow card."
                  />
                </div>
                <div id="proof-title">
                  <Title>
                    <FormattedMessage
                      defaultMessage="Apply proof sealed"
                      description="Heading for the post-apply verification evidence."
                    />
                  </Title>
                </div>
              </div>
              <span className="hf-proof-seal" aria-hidden="true">
                ✓
              </span>
            </div>

            <div className="hf-card-copy">
              <Text>
                <FormattedMessage
                  defaultMessage="Scenario {id} changed {count, number} element(s) and the Canva post-state matched the reviewed expectation."
                  description="Summarizes the immutable verification receipt after apply."
                  values={{ id: receipt.scenarioId, count: receipt.changedElementIds.length }}
                />
              </Text>
            </div>

            <div className="hf-proof-list">
              <div className="hf-proof-row">
                <span className="hf-proof-label">
                  <FormattedMessage
                    defaultMessage="Reviewed target"
                    description="Label for the design and page bound into the reviewed apply proof."
                  />
                </span>
                <span className="hf-proof-value">
                  {attestation.designId} · {attestation.pageId}
                </span>
              </div>
              <div className="hf-proof-row">
                <span className="hf-proof-label">
                  <FormattedMessage
                    defaultMessage="Source fingerprint"
                    description="Label for the source fingerprint in the apply attestation."
                  />
                </span>
                <span className="hf-proof-value">{`${attestation.sourceFingerprint.slice(0, 18)}…`}</span>
              </div>
              <div className="hf-proof-row">
                <span className="hf-proof-label">
                  <FormattedMessage
                    defaultMessage="Expected → result"
                    description="Label for the expected and resulting design-state fingerprints."
                  />
                </span>
                <span className="hf-proof-value">
                  {`${receipt.expectedFingerprint.slice(0, 12)}…`} →{" "}
                  {`${receipt.resultingFingerprint.slice(0, 12)}…`}
                </span>
              </div>
              <div className="hf-proof-row">
                <span className="hf-proof-label">
                  <FormattedMessage
                    defaultMessage="Sealed evidence"
                    description="Label for the immutable receipt and attestation identifiers."
                  />
                </span>
                <span className="hf-proof-value">
                  {`${receipt.receiptFingerprint.slice(0, 12)}…`} ·{" "}
                  {`${attestation.attestationFingerprint.slice(0, 12)}…`}
                </span>
              </div>
            </div>
          </section>
        )}
      </Rows>
    </div>
  );
}
