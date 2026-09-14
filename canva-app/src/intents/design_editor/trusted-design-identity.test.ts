import { describe, expect, it, vi } from "vitest";

import { resolveTrustedDesignIdentity } from "./trusted-design-identity";

describe("resolveTrustedDesignIdentity", () => {
  it("passes the fresh token opaquely to the trusted resolver", async () => {
    const getFreshDesignToken = vi.fn().mockResolvedValue("signed-token");
    const resolveWithBackend = vi.fn().mockResolvedValue({
      designId: " design-123 ",
      appId: " app-456 ",
    });

    await expect(
      resolveTrustedDesignIdentity(getFreshDesignToken, resolveWithBackend),
    ).resolves.toEqual({ designId: "design-123", appId: "app-456" });

    expect(getFreshDesignToken).toHaveBeenCalledOnce();
    expect(resolveWithBackend).toHaveBeenCalledOnce();
    expect(resolveWithBackend).toHaveBeenCalledWith("signed-token");
  });

  it("fails closed when Canva returns no token", async () => {
    const resolveWithBackend = vi.fn();

    await expect(
      resolveTrustedDesignIdentity(() => Promise.resolve("  "), resolveWithBackend),
    ).rejects.toThrow("fresh design token");

    expect(resolveWithBackend).not.toHaveBeenCalled();
  });

  it("fails closed when the trusted resolver returns no design ID", async () => {
    const resolveWithBackend = vi.fn().mockResolvedValue({ designId: "   " });

    await expect(
      resolveTrustedDesignIdentity(() => Promise.resolve("signed-token"), resolveWithBackend),
    ).rejects.toThrow("did not return a design ID");
  });

  it("does not require or decode JWT structure in the browser", async () => {
    const opaqueToken = "not-a-jwt-and-not-for-browser-decoding";
    const resolveWithBackend = vi.fn().mockResolvedValue({ designId: "design-123" });

    await expect(
      resolveTrustedDesignIdentity(() => Promise.resolve(opaqueToken), resolveWithBackend),
    ).resolves.toEqual({ designId: "design-123" });
  });
});
