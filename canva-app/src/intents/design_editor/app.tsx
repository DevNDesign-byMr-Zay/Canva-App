import { Alert, Button, Rows, Text, Title } from "@canva/app-ui-kit";
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
  isReviewedApplyContextCurrent,
} from "./review-context-guard";
import { buildScenarioReview } from "./scenario-review";

export type AppScenario = Parameters<typeof canApplyScenario>[0];

type AppProps = {
  scenario?: AppScenario;
  /** Design ID returned by the trusted backend/token verification seam. */
  trustedDesignId?: string;
};

type AppStatus = "idle" | "reading" | "applying" | "done" | "warning" | "error";

export function App({ scenario = null, trustedDesignId }: AppProps) {
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
  const latestReviewContext = useRef<{
    scenario: NonNullable<AppScenario>;
    snapshot: CanvaDesignSnapshot;
    trustedDesignId?: string;
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
      scenario && snapshot ? { scenario, snapshot, trustedDesignId } : null;
  }, [scenario, snapshot, trustedDesignId]);

  useEffect(() => {
    let cancelled = false;
    setScenarioVerified(false);
    const normalizedTrustedDesignId = trustedDesignId?.trim();
    if (
      !scenario ||
      !snapshot ||
      !designEditingSupported ||
      (normalizedTrustedDesignId && snapshot.designId !== normalizedTrustedDesignId)
    ) {
      return () => {
        cancelled = true;
      };
    }

    void canApplyScenario(scenario, snapshot).then((safe) => {
      if (!cancelled) setScenarioVerified(safe);
    });

    return () => {
      cancelled = true;
    };
  }, [designEditingSupported, scenario, snapshot, trustedDesignId]);

  const review = useMemo(
    () => (scenario && snapshot ? buildScenarioReview(scenario, snapshot) : []),
    [scenario, snapshot],
  );

  const readyToApply = designEditingSupported && scenarioVerified;

  const apply = useCallback(async () => {
    if (!scenario || !snapshot || !readyToApply) return;
    const runToken = applyRunGate.current.tryAcquire();
    if (runToken === null) return;

    setStatus("applying");
    setMessage(null);
    setReceipt(null);
    setAttestation(null);

    try {
      const reviewedSnapshot = snapshot;
      const reviewedContext = createReviewedApplyContext({
        scenario,
        snapshot: reviewedSnapshot,
        trustedDesignId,
      });
      const result = await applyScenario(scenario, reviewedSnapshot);
      const sealedAttestation = await createApplyAttestation({
        scenario,
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
          intl.formatMessage({
            defaultMessage:
              "The selected changes were applied, verified, and attested, but HoloForge could not refresh the current design afterward. Your verified proof remains available below. Read the current design before applying another scenario.",
            description:
              "Warning shown after a successful verified Apply when the follow-up Canva design refresh fails.",
          }),
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
  }, [intl, readyToApply, scenario, snapshot, trustedDesignId]);

  const messageTone = status === "error" ? "critical" : status === "warning" ? "warn" : "positive";

  return (
    <Rows spacing="2u">
      <Title>
        <FormattedMessage defaultMessage="HoloForge" description="Name of the HoloForge Canva app." />
      </Title>

      <Text>
        <FormattedMessage
          defaultMessage="Compare an evidence-backed scenario with the current design, then choose whether to apply it."
          description="Explains the purpose of HoloForge in the Canva editor."
        />
      </Text>

      {!designEditingSupported && (
        <Alert tone="warn">
          <FormattedMessage
            defaultMessage="Design editing isn't supported in this Canva context. Preview remains read-only."
            description="Capability warning when Canva does not support design editing in the current context."
          />
        </Alert>
      )}

      {message && <Alert tone={messageTone}>{message}</Alert>}

      <Rows spacing="1u">
        <Button
          variant="secondary"
          onClick={refresh}
          loading={status === "reading"}
          disabled={status === "applying"}
          stretch
        >
          {refreshLabel}
        </Button>

        <Text>
          {snapshot ? (
            <FormattedMessage
              defaultMessage="Snapshot ready · {count, number} element(s) · fingerprint {fingerprint}"
              description="Shows the current Canva snapshot state used for stale-scenario protection."
              values={{
                count: snapshot.elements.length,
                fingerprint: `${snapshot.fingerprint.slice(0, 12)}…`,
              }}
            />
          ) : (
            <FormattedMessage
              defaultMessage="No design snapshot yet. Read the current design before reviewing a candidate."
              description="Empty state before the current Canva design has been read."
            />
          )}
        </Text>
      </Rows>

      {scenario ? (
        <Rows spacing="1u">
          <Text>
            <FormattedMessage
              defaultMessage="Selected scenario: {id}"
              description="Identifies the scenario currently selected for review."
              values={{ id: scenario.scenarioId }}
            />
          </Text>

          {snapshot && (
            <Rows spacing="0.5u">
              <Text>
                <FormattedMessage
                  defaultMessage="Review: {count, number} element change(s)"
                  description="Summarizes the selected scenario changes before apply."
                  values={{ count: review.length }}
                />
              </Text>
              {review.map(({ elementId, before, after, changedFields }) => (
                <Text key={elementId}>
                  {elementId}: {before.left}×{before.top} {before.width}×{before.height} → {after.left}×
                  {after.top} {after.width}×{after.height} · {changedFields.join(", ")}
                </Text>
              ))}
              {review.length === 0 && (
                <Text>
                  <FormattedMessage
                    defaultMessage="No reviewable Canva element mapping was found for this candidate."
                    description="Explains an empty candidate projection without inventing a mapping."
                  />
                </Text>
              )}
            </Rows>
          )}

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
            <Text>
              <FormattedMessage
                defaultMessage="Apply stays locked until the canonical scenario provenance and current Canva snapshot are verified."
                description="Explains why HoloForge keeps the apply action disabled."
              />
            </Text>
          )}
        </Rows>
      ) : (
        <Alert tone="info">
          <FormattedMessage
            defaultMessage="Waiting for an upstream scenario candidate. HoloForge will not invent a layout or silently change your design."
            description="Explains that scenario generation happens upstream and HoloForge is not an autonomous solver."
          />
        </Alert>
      )}

      {receipt && attestation && (
        <Rows spacing="0.5u">
          <Title>
            <FormattedMessage
              defaultMessage="Verified result"
              description="Heading for the post-apply verification evidence shown after a successful apply."
            />
          </Title>
          <Text>
            <FormattedMessage
              defaultMessage="Scenario {id} · {count, number} changed element(s) · post-apply state matched the reviewed expectation."
              description="Summarizes the immutable verification receipt after apply."
              values={{ id: receipt.scenarioId, count: receipt.changedElementIds.length }}
            />
          </Text>
          <Text>
            <FormattedMessage
              defaultMessage="Expected {expected} · Result {result}"
              description="Shows the expected and resulting state fingerprints from the verification receipt."
              values={{
                expected: `${receipt.expectedFingerprint.slice(0, 12)}…`,
                result: `${receipt.resultingFingerprint.slice(0, 12)}…`,
              }}
            />
          </Text>
          <Text>
            <FormattedMessage
              defaultMessage="Receipt {receiptFingerprint} · Attestation {attestationFingerprint} · explicit apply · no auto-apply"
              description="Shows the receipt and reviewed apply attestation fingerprints and their safety posture."
              values={{
                receiptFingerprint: `${receipt.receiptFingerprint.slice(0, 12)}…`,
                attestationFingerprint: `${attestation.attestationFingerprint.slice(0, 12)}…`,
              }}
            />
          </Text>
        </Rows>
      )}
    </Rows>
  );
}
