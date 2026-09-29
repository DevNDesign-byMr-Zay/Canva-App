import { describe, expect, it } from "vitest";

import { createApplyRunGate } from "./apply-run-gate";

describe("apply run gate", () => {
  it("allows exactly one in-flight apply until the matching token releases", () => {
    const gate = createApplyRunGate();

    const first = gate.tryAcquire();
    expect(first).not.toBeNull();
    expect(gate.isHeld()).toBe(true);
    expect(gate.tryAcquire()).toBeNull();

    expect(gate.release((first ?? 0) + 1)).toBe(false);
    expect(gate.isHeld()).toBe(true);
    expect(gate.tryAcquire()).toBeNull();

    expect(gate.release(first ?? 0)).toBe(true);
    expect(gate.isHeld()).toBe(false);

    const second = gate.tryAcquire();
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
  });

  it("cannot be reset by stale release tokens from older apply runs", () => {
    const gate = createApplyRunGate();
    const first = gate.tryAcquire();
    expect(first).not.toBeNull();
    expect(gate.release(first ?? 0)).toBe(true);

    const second = gate.tryAcquire();
    expect(second).not.toBeNull();
    expect(gate.release(first ?? 0)).toBe(false);
    expect(gate.isHeld()).toBe(true);
    expect(gate.release(second ?? 0)).toBe(true);
  });
});
