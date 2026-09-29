import { beforeEach, describe, expect, it, vi } from "vitest";

const getDesignMetadata = vi.fn();
const getCurrentPageMetadata = vi.fn();
const openDesign = vi.fn();

vi.mock("@canva/design", () => ({
  getDesignMetadata,
  getCurrentPageMetadata,
  openDesign,
}));

describe("DepthPop Canva source context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDesignMetadata.mockResolvedValue({ title: "Depth campaign" });
    getCurrentPageMetadata.mockResolvedValue({ type: "absolute", id: "page-1" });
    openDesign.mockImplementation(async (_scope, callback) =>
      callback({
        page: { type: "absolute", id: "page-1", elements: { toArray: () => [{}, {}, {}] } },
      }),
    );
  });

  it("reads only the source context DepthPop needs", async () => {
    const { readDepthPopSourceSnapshot } = await import("./canva-context");
    await expect(readDepthPopSourceSnapshot()).resolves.toEqual({
      designTitle: "Depth campaign",
      pageId: "page-1",
      elementCount: 3,
    });
  });

  it("fails closed for an unsupported page", async () => {
    getCurrentPageMetadata.mockResolvedValue({ type: "unsupported", id: "page-1" });
    const { readDepthPopSourceSnapshot } = await import("./canva-context");
    await expect(readDepthPopSourceSnapshot()).rejects.toThrow(/requires a Canva design page/i);
  });

  it("fails when the page changes during the read", async () => {
    openDesign.mockImplementation(async (_scope, callback) =>
      callback({
        page: { type: "absolute", id: "page-2", elements: { toArray: () => [] } },
      }),
    );
    const { readDepthPopSourceSnapshot } = await import("./canva-context");
    await expect(readDepthPopSourceSnapshot()).rejects.toThrow(/changed while DepthPop was reading/i);
  });
});
