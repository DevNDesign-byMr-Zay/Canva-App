// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import type { ReactNode } from "react";

const boundary = vi.hoisted(() => ({
  supported: true,
  read: vi.fn(),
  verify: vi.fn(),
  apply: vi.fn(),
  attest: vi.fn(),
  current: vi.fn(),
  proofCurrent: vi.fn(),
}));
vi.mock("@canva/app-hooks", () => ({ useFeatureSupport: () => () => boundary.supported }));
vi.mock("@canva/design", () => ({ openDesign: vi.fn() }));
vi.mock("@canva/app-ui-kit", () => {
  const Container = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    Alert: Container,
    Rows: Container,
    Text: Container,
    Title: Container,
    Button: ({
      children,
      onClick,
      disabled,
      loading,
    }: {
      children: ReactNode;
      onClick: () => void;
      disabled: boolean;
      loading: boolean;
    }) => (
      <button disabled={disabled || loading} onClick={onClick}>
        {children}
      </button>
    ),
  };
});
vi.mock("./canva-design", () => ({
  readCurrentDesignSnapshot: (...args: unknown[]) => boundary.read(...args),
  canApplyScenario: (...args: unknown[]) => boundary.verify(...args),
  applyScenario: (...args: unknown[]) => boundary.apply(...args),
}));
vi.mock("./apply-attestation", () => ({
  createApplyAttestation: (...args: unknown[]) => boundary.attest(...args),
}));
vi.mock("./review-context-guard", () => ({
  createReviewedApplyContext: (value: unknown) => value,
  isReviewedApplyContextCurrent: (...args: unknown[]) => boundary.current(...args),
  isApplyProofCurrentForReview: (...args: unknown[]) => boundary.proofCurrent(...args),
}));
// The production build injects translation IDs. UI tests keep message text visible
// without invoking that build-time transform or the Canva host.
vi.mock("react-intl", () => {
  const intl = {
    formatMessage: ({ defaultMessage }: { defaultMessage: string }) => defaultMessage,
  };
  return {
    IntlProvider: ({ children }: { children: ReactNode }) => children,
    useIntl: () => intl,
    FormattedMessage: ({ defaultMessage }: { defaultMessage: string }) => defaultMessage,
  };
});
import { App, type AppScenario } from "./app";

const scenario: NonNullable<AppScenario> = {
  contractVersion: 1,
  scenarioId: "ui-scenario",
  source: {
    designId: "design-1",
    snapshotId: "snapshot-1",
    pageIds: ["page-1"],
    snapshotFingerprint: "a".repeat(64),
  },
  intent: { summary: "Review", objectiveId: "balance", objectiveDirection: "maximize" },
  constraints: { hard: [], soft: [] },
  candidate: { layout: { elements: {} }, changedElementIds: [], delta: {} },
  evidence: {
    backend: "reference",
    algorithm: "deterministic",
    seed: "1",
    status: "complete",
    objectiveScore: 1,
    baseline: { backend: "reference", algorithm: "baseline", objectiveScore: 0 },
    objectiveGap: 1,
    durationMs: 1,
    hardConstraintsPassed: true,
    warnings: [],
  },
  interpretation: { producer: "upstream", label: "review", summary: "Review", tradeoffs: [] },
  presentation: { advisoryOnly: true, autoApply: false, target: "web-dashboard" },
  provenance: { scenarioFingerprint: "b".repeat(64), optimizationFingerprint: "c".repeat(64) },
};
const snapshot = {
  designId: "design-1",
  pageId: "page-1",
  fingerprint: "a".repeat(64),
  elements: [],
};
const receipt = {
  scenarioId: "ui-scenario",
  changedElementIds: [],
  expectedFingerprint: "d".repeat(64),
  resultingFingerprint: "d".repeat(64),
  receiptFingerprint: "e".repeat(64),
};
const attestation = {
  designId: "design-1",
  pageId: "page-1",
  sourceFingerprint: "a".repeat(64),
  attestationFingerprint: "f".repeat(64),
};
function mount(props = {}) {
  return render(
    <IntlProvider locale="en">
      <App scenario={scenario} trustedDesignId="design-1" trustedPageId="page-1" {...props} />
    </IntlProvider>,
  );
}
async function readAndReady() {
  fireEvent.click(screen.getByText("Read current design"));
  await waitFor(() =>
    expect((screen.getByText("Apply selected scenario") as HTMLButtonElement).disabled).toBe(false),
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  boundary.supported = true;
  boundary.read.mockResolvedValue(snapshot);
  boundary.verify.mockResolvedValue(true);
  boundary.apply.mockResolvedValue(receipt);
  boundary.attest.mockResolvedValue(attestation);
  boundary.current.mockReturnValue(true);
  boundary.proofCurrent.mockReturnValue(true);
});
afterEach(cleanup);

it("never applies automatically and requires an explicit verified action", async () => {
  mount();
  expect((screen.getByText("Apply selected scenario") as HTMLButtonElement).disabled).toBe(true);
  await readAndReady();
  expect(boundary.apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Apply selected scenario"));
  await screen.findByText("Verified result");
  expect(boundary.apply).toHaveBeenCalledTimes(1);
  expect(boundary.apply).toHaveBeenCalledWith(scenario, snapshot);
});
it("renders a read-only waiting state without a scenario or editing capability", () => {
  boundary.supported = false;
  mount({ scenario: null });
  expect(screen.getByText(/Preview remains read-only/)).toBeTruthy();
  expect(screen.queryByText("Apply selected scenario")).toBeNull();
  expect(boundary.apply).not.toHaveBeenCalled();
});
it.each([new Error("read failed"), "unknown"])(
  "shows read failures and keeps Apply locked",
  async (error) => {
    boundary.read.mockRejectedValue(error);
    mount();
    fireEvent.click(screen.getByText("Read current design"));
    await screen.findByText(
      error instanceof Error ? error.message : "We couldn't read the current Canva design.",
    );
    expect((screen.getByText("Apply selected scenario") as HTMLButtonElement).disabled).toBe(true);
  },
);
it.each(["designId", "pageId"])(
  "rejects a snapshot with a mismatched trusted %s",
  async (field) => {
    boundary.read.mockResolvedValue({ ...snapshot, [field]: "wrong" });
    mount();
    fireEvent.click(screen.getByText("Read current design"));
    await screen.findByText(/Snapshot ready/);
    expect(boundary.verify).not.toHaveBeenCalled();
    expect((screen.getByText("Apply selected scenario") as HTMLButtonElement).disabled).toBe(true);
  },
);
it.each([new Error("apply failed"), "unknown"])("hides proof when Apply fails", async (error) => {
  boundary.apply.mockRejectedValue(error);
  mount();
  await readAndReady();
  fireEvent.click(screen.getByText("Apply selected scenario"));
  await screen.findByText(
    error instanceof Error ? error.message : "The selected scenario could not be applied.",
  );
  expect(screen.queryByText("Verified result")).toBeNull();
});
it("retains verified proof with a warning if post-apply refresh fails", async () => {
  boundary.read.mockResolvedValueOnce(snapshot).mockRejectedValue(new Error("offline"));
  mount();
  await readAndReady();
  fireEvent.click(screen.getByText("Apply selected scenario"));
  await screen.findByText(/could not refresh the current design afterward/);
  expect(screen.getByText("Verified result")).toBeTruthy();
});
it.each([false, true])("hides stale in-flight proof, refresh failure=%s", async (refreshFails) => {
  boundary.current.mockReturnValue(false);
  if (refreshFails)
    boundary.read.mockResolvedValueOnce(snapshot).mockRejectedValue(new Error("offline"));
  mount();
  await readAndReady();
  fireEvent.click(screen.getByText("Apply selected scenario"));
  await screen.findByText(/selected review changed while Apply was running/);
  expect(screen.queryByText("Verified result")).toBeNull();
});
it("discards proof when the reviewed target changes", async () => {
  const view = mount();
  await readAndReady();
  fireEvent.click(screen.getByText("Apply selected scenario"));
  await screen.findByText("Verified result");
  boundary.proofCurrent.mockReturnValue(false);
  view.rerender(
    <IntlProvider locale="en">
      <App scenario={scenario} trustedDesignId="design-2" />
    </IntlProvider>,
  );
  await waitFor(() => expect(screen.queryByText("Verified result")).toBeNull());
});
