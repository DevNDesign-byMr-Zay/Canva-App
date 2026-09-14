import { Alert, Button, Rows, Text, Title } from "@canva/app-ui-kit";
import { useFeatureSupport } from "@canva/app-hooks";
import { openDesign } from "@canva/design";
import { FormattedMessage, useIntl } from "react-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  applyScenario,
  canApplyScenario,
  readCurrentDesignSnapshot,
  type CanvaDesignSnapshot,
} from "./canva-design";
import { buildScenarioReview } from "./scenario-review";

export type AppScenario = Parameters<typeof canApplyScenario>[0];

type AppProps = {
  scenario?: AppScenario;
  /** Design ID returned by the trusted backend/token verification seam. */
  trustedDesignId?: string;
};

export function App({ scenario = null, trustedDesignId }: AppProps) {
  const intl = useIntl();
  const isSupported = useFeatureSupport();
  const designEditingSupported = isSupported(openDesign);
  const [snapshot, setSnapshot] = useState<CanvaDesignSnapshot | null>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "applying" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [scenarioVerified, setScenarioVerified] = useState(false);

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

    try {
      setSnapshot(await readCurrentDesignSnapshot({ trustedDesignId }));
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : intl.formatMessage({
        defaultMessage: "We couldn't read the current Canva design.",
        description: "Error shown when HoloForge cannot read the current Canva design.",
      }));
    }
  }, [intl, trustedDesignId]);

  useEffect(() => {
    let cancelled = false;
    setScenarioVerified(false);
    if (!scenario || !snapshot || !designEditingSupported) return () => { cancelled = true; };

    void canApplyScenario(scenario, snapshot).then((safe) => {
      if (!cancelled) setScenarioVerified(safe);
    });

    return () => { cancelled = true; };
  }, [designEditingSupported, scenario, snapshot]);

  const review = useMemo(
    () => (scenario && snapshot ? buildScenarioReview(scenario, snapshot) : []),
    [scenario, snapshot],
  );

  const readyToApply = designEditingSupported && scenarioVerified;

  const apply = useCallback(async () => {
    if (!scenario || !snapshot || !readyToApply) return;

    setStatus("applying");
    setMessage(null);

    try {
      const result = await applyScenario(scenario, snapshot);
      setStatus("done");
      setMessage(intl.formatMessage({
        defaultMessage: "Applied {count, number} selected change(s) as one Canva undo action.",
        description: "Confirmation after applying one selected HoloForge scenario to Canva.",
      }, { count: result.changedElementIds.length }));
      setSnapshot(await readCurrentDesignSnapshot({ trustedDesignId }));
      setScenarioVerified(false);
    } catch (error) {
      setStatus("error");
      setScenarioVerified(false);
      setMessage(error instanceof Error ? error.message : intl.formatMessage({
        defaultMessage: "The selected scenario could not be applied.",
        description: "Error shown when a selected HoloForge scenario fails to apply.",
      }));
    }
  }, [intl, readyToApply, scenario, snapshot, trustedDesignId]);

  return (
    <Rows spacing="2u">
      <Title>
        <FormattedMessage
          defaultMessage="HoloForge"
          description="Name of the HoloForge Canva app."
        />
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

      {message && <Alert tone={status === "error" ? "critical" : "positive"}>{message}</Alert>}

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
              values={{ count: snapshot.elements.length, fingerprint: `${snapshot.fingerprint.slice(0, 12)}…` }}
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
                  {elementId}: {before.left}×{before.top} {before.width}×{before.height} → {after.left}×{after.top} {after.width}×{after.height} · {changedFields.join(", ")}
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
    </Rows>
  );
}
