import { Alert, Button, Rows, Text, Title } from "@canva/app-ui-kit";
import { useFeatureSupport } from "@canva/app-hooks";
import { openDesign } from "@canva/design";
import { FormattedMessage, useIntl } from "react-intl";
import { useCallback, useState } from "react";

import {
  applyScenario,
  canApplyScenario,
  readCurrentDesignSnapshot,
  type CanvaDesignSnapshot,
} from "./canva-design";

export type AppScenario = Parameters<typeof canApplyScenario>[0];

export function App({ scenario = null }: { scenario?: AppScenario }) {
  const intl = useIntl();
  const isSupported = useFeatureSupport();
  const designEditingSupported = isSupported(openDesign);
  const [snapshot, setSnapshot] = useState<CanvaDesignSnapshot | null>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "applying" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  const readDesignLabel = intl.formatMessage({
    defaultMessage: "Read current design",
    description: "Button that captures the current Canva design snapshot for scenario comparison.",
  });
  const applyScenarioLabel = intl.formatMessage({
    defaultMessage: "Apply selected scenario",
    description: "Explicit action to apply the selected HoloForge scenario to the Canva design.",
  });

  const refresh = useCallback(async () => {
    setStatus("reading");
    setMessage(null);

    try {
      setSnapshot(await readCurrentDesignSnapshot());
      setStatus("idle");
    } catch (error) {
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
  }, [intl]);

  const readyToApply = designEditingSupported && canApplyScenario(scenario, snapshot);

  const apply = useCallback(async () => {
    if (!scenario || !snapshot || !readyToApply) return;

    setStatus("applying");
    setMessage(null);

    try {
      const result = await applyScenario(scenario, snapshot);
      setStatus("done");
      setMessage(
        intl.formatMessage(
          {
            defaultMessage: "Applied {count, number} selected change(s) as one Canva undo action.",
            description: "Confirmation after applying one selected HoloForge scenario to Canva.",
          },
          { count: result.changedElementIds.length },
        ),
      );
      setSnapshot(await readCurrentDesignSnapshot());
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : intl.formatMessage({
              defaultMessage: "The selected scenario could not be applied.",
              description: "Error shown when a selected HoloForge scenario fails to apply.",
            }),
      );
    }
  }, [intl, readyToApply, scenario, snapshot]);

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
          {readDesignLabel}
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
          <Button
            variant="primary"
            onClick={apply}
            loading={status === "applying"}
            disabled={!readyToApply || status === "reading"}
            stretch
          >
            {applyScenarioLabel}
          </Button>
          {!readyToApply && (
            <Text>
              <FormattedMessage
                defaultMessage="Apply stays locked until the scenario is verified, matches this snapshot, passes its gates, and is supported here."
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
