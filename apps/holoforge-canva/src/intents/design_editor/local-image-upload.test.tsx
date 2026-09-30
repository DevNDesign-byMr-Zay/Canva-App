import { beforeEach, describe, expect, it, vi } from "vitest";

const { uploadMock, addElementAtPointMock } = vi.hoisted(() => ({
  uploadMock: vi.fn(),
  addElementAtPointMock: vi.fn(),
}));

vi.mock("@canva/asset", () => ({
  upload: uploadMock,
}));

vi.mock("@canva/design", () => ({
  addElementAtPoint: addElementAtPointMock,
}));

import { uploadDataUrlToCanva } from "./local-image-upload";

describe("uploadDataUrlToCanva", () => {
  beforeEach(() => {
    uploadMock.mockReset();
    addElementAtPointMock.mockReset();
  });

  it("uploads a private Canva image asset and inserts it into the current design", async () => {
    const whenUploaded = vi.fn().mockResolvedValue(undefined);
    uploadMock.mockResolvedValue({
      ref: "asset-ref-123",
      whenUploaded,
    });
    addElementAtPointMock.mockResolvedValue(undefined);

    const stages: string[] = [];
    const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";

    await uploadDataUrlToCanva(
      {
        dataUrl,
        mimeType: "image/png",
        fileName: "test-source.png",
        productName: "TEST APP",
      },
      (stage) => stages.push(stage),
    );

    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(uploadMock).toHaveBeenCalledWith({
      type: "image",
      name: "test-source.png",
      mimeType: "image/png",
      url: dataUrl,
      thumbnailUrl: dataUrl,
      aiDisclosure: "none",
    });
    expect(whenUploaded).toHaveBeenCalledTimes(1);
    expect(addElementAtPointMock).toHaveBeenCalledWith({
      type: "image",
      ref: "asset-ref-123",
      altText: {
        text: "TEST APP source image",
        decorative: false,
      },
    });
    expect(stages).toEqual(["uploading", "adding"]);
  });

  it("can stage an upload without inserting the raw source into the design", async () => {
    const whenUploaded = vi.fn().mockResolvedValue(undefined);
    uploadMock.mockResolvedValue({
      ref: "asset-ref-staged",
      whenUploaded,
    });

    const result = await uploadDataUrlToCanva({
      dataUrl: "data:image/png;base64,AAAA",
      mimeType: "image/png",
      fileName: "logo.png",
      productName: "TEST APP",
      insertIntoDesign: false,
    });

    expect(result.ref).toBe("asset-ref-staged");
    expect(whenUploaded).toHaveBeenCalledTimes(1);
    expect(addElementAtPointMock).not.toHaveBeenCalled();
  });

  it("rejects a mismatched data URL before calling Canva", async () => {
    await expect(
      uploadDataUrlToCanva({
        dataUrl: "data:image/jpeg;base64,AAAA",
        mimeType: "image/png",
        fileName: "bad.png",
        productName: "TEST APP",
      }),
    ).rejects.toThrow("does not match");

    expect(uploadMock).not.toHaveBeenCalled();
    expect(addElementAtPointMock).not.toHaveBeenCalled();
  });

  it("rejects an encoded upload beyond Canva's 10 MB data-URL limit", async () => {
    const prefix = "data:image/png;base64,";
    const oversized = prefix + "A".repeat(10 * 1024 * 1024);

    await expect(
      uploadDataUrlToCanva({
        dataUrl: oversized,
        mimeType: "image/png",
        fileName: "oversized.png",
        productName: "TEST APP",
      }),
    ).rejects.toThrow("10 MB");

    expect(uploadMock).not.toHaveBeenCalled();
    expect(addElementAtPointMock).not.toHaveBeenCalled();
  });
});
