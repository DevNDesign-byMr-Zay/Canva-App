import { describe, expect, it, vi } from "vitest";

import { DepthTextureCache } from "./depth-texture-cache";

describe("DepthTextureCache", () => {
  it("deduplicates authenticated asset resolution", async () => {
    const resolver = vi.fn(async () => "blob:owned-cutout");
    const cache = new DepthTextureCache(resolver);

    const [first, second] = await Promise.all([
      cache.resolve("/api/v1/assets/cutout"),
      cache.resolve("/api/v1/assets/cutout"),
    ]);

    expect(first).toBe("blob:owned-cutout");
    expect(second).toBe("blob:owned-cutout");
    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it("passes inline data and blob URLs through without fetching", async () => {
    const resolver = vi.fn(async () => "blob:unexpected");
    const cache = new DepthTextureCache(resolver);

    expect(await cache.resolve("data:image/png;base64,AA==")).toBe(
      "data:image/png;base64,AA==",
    );
    expect(await cache.resolve("blob:existing")).toBe("blob:existing");
    expect(resolver).not.toHaveBeenCalled();
  });

  it("revokes each cache-owned blob URL exactly once on dispose", async () => {
    const resolver = vi
      .fn()
      .mockResolvedValueOnce("blob:first")
      .mockResolvedValueOnce("blob:second");
    const revoke = vi.fn();
    const cache = new DepthTextureCache(resolver, revoke);

    await cache.resolve("/api/v1/assets/a");
    await cache.resolve("/api/v1/assets/b");
    await cache.resolve("/api/v1/assets/a");

    cache.dispose();
    cache.dispose();

    expect(revoke.mock.calls.map(([url]) => url).sort()).toEqual([
      "blob:first",
      "blob:second",
    ]);
  });

  it("does not cache a failed authenticated asset request", async () => {
    const resolver = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          "DepthPop refused to send Canva authorization to a cross-origin scene asset.",
        ),
      )
      .mockResolvedValueOnce("blob:retry");

    const cache = new DepthTextureCache(resolver);

    await expect(cache.resolve("https://evil.example/cutout.png")).rejects.toThrow(
      "cross-origin scene asset",
    );
    await expect(
      cache.resolve("https://evil.example/cutout.png"),
    ).resolves.toBe("blob:retry");
    expect(resolver).toHaveBeenCalledTimes(2);
  });

  it("disposes a blob that resolves after the cache was already disposed", async () => {
    let complete!: (value: string) => void;
    const resolver = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          complete = resolve;
        }),
    );
    const revoke = vi.fn();
    const cache = new DepthTextureCache(resolver, revoke);

    const pending = cache.resolve("/api/v1/assets/slow");
    cache.dispose();
    complete("blob:late");

    await expect(pending).rejects.toThrow("DepthPop texture cache was disposed");
    expect(revoke).toHaveBeenCalledWith("blob:late");
  });
});
