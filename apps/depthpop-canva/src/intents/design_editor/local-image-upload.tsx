import React, { useId, useState } from "react";
import { type ImageRef, upload } from "@canva/asset";
import { addElementAtPoint } from "@canva/design";

const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_RAW_BYTES = 7 * 1024 * 1024;
const MAX_DATA_URL_CHARACTERS = 10 * 1024 * 1024;

type SupportedImageMime = "image/png" | "image/jpeg" | "image/webp";
type UploadStage = "uploading" | "adding";

export type UploadedImageResult = Readonly<{
  ref: ImageRef;
  fileName: string;
  mimeType: SupportedImageMime;
  dataUrl: string;
}>;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("The selected image could not be read."));
    reader.onload = () => {
      if (
        typeof reader.result !== "string" ||
        !reader.result.startsWith("data:")
      ) {
        reject(
          new Error(
            "The selected image could not be converted for Canva upload.",
          ),
        );
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadDataUrlToCanva(
  input: Readonly<{
    dataUrl: string;
    mimeType: SupportedImageMime;
    fileName: string;
    productName: string;
    insertIntoDesign?: boolean;
  }>,
  onStage?: (stage: UploadStage) => void,
): Promise<UploadedImageResult> {
  if (!input.dataUrl.startsWith(`data:${input.mimeType};base64,`)) {
    throw new Error(
      "The local image data does not match the selected file type.",
    );
  }
  if (input.dataUrl.length > MAX_DATA_URL_CHARACTERS) {
    throw new Error(
      "The encoded image exceeds Canva's 10 MB data-URL upload limit.",
    );
  }

  onStage?.("uploading");
  const asset = await upload({
    type: "image",
    name: input.fileName,
    mimeType: input.mimeType,
    url: input.dataUrl,
    thumbnailUrl: input.dataUrl,
    aiDisclosure: "none",
  });
  await asset.whenUploaded();

  if (input.insertIntoDesign !== false) {
    onStage?.("adding");
    await addElementAtPoint({
      type: "image",
      ref: asset.ref,
      altText: {
        text: input.productName + " source image",
        decorative: false,
      },
    });
  }

  return Object.freeze({
    ref: asset.ref,
    fileName: input.fileName,
    mimeType: input.mimeType,
    dataUrl: input.dataUrl,
  });
}

export type LocalImageUploadProps = Readonly<{
  productName: string;
  classPrefix: "hf" | "dp";
  onUploaded?: (result: UploadedImageResult) => void;
  insertIntoDesign?: boolean;
  sourceLabel?: string;
}>;

export function LocalImageUpload({
  productName,
  classPrefix,
  onUploaded,
  insertIntoDesign = true,
  sourceLabel = "SOURCE IMAGE",
}: LocalImageUploadProps) {
  const reactId = useId();
  const inputId = `${classPrefix}-local-image-${reactId.replace(/:/g, "")}`;
  const [status, setStatus] = useState<
    "idle" | "reading" | "uploading" | "adding" | "done" | "error"
  >("idle");
  const [message, setMessage] = useState(
    "Choose or drop a PNG, JPEG, or WebP image.",
  );
  const busy =
    status === "reading" || status === "uploading" || status === "adding";

  const processFile = async (file: File) => {
    if (busy) return;

    if (!ACCEPTED_TYPES.has(file.type)) {
      setStatus("error");
      setMessage("Use a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size <= 0 || file.size > MAX_RAW_BYTES) {
      setStatus("error");
      setMessage("Use a non-empty image up to 7 MB.");
      return;
    }

    try {
      setStatus("reading");
      setMessage("Preparing the local image…");
      const dataUrl = await readAsDataUrl(file);

      const result = await uploadDataUrlToCanva(
        {
          dataUrl,
          mimeType: file.type as SupportedImageMime,
          fileName: file.name,
          productName,
          insertIntoDesign,
        },
        (stage) => {
          setStatus(stage);
          setMessage(
            stage === "uploading"
              ? "Uploading to your Canva media library…"
              : "Adding the uploaded image to the current Canva design…",
          );
        },
      );

      setStatus("done");
      setMessage(
        insertIntoDesign
          ? `${file.name} uploaded and added to Canva.`
          : `${file.name} uploaded and ready as a ${productName} source.`,
      );
      onUploaded?.(result);
    } catch (cause) {
      setStatus("error");
      setMessage(
        cause instanceof Error
          ? cause.message
          : "The Canva image upload failed.",
      );
    }
  };

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) await processFile(file);
  };

  return (
    <section
      className={classPrefix + "-upload-card"}
      aria-label={productName + " image upload"}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (file) void processFile(file);
      }}
    >
      <div className={classPrefix + "-upload-copy"}>
        <span className={classPrefix + "-upload-kicker"}>{sourceLabel}</span>
        <strong>Upload image to Canva</strong>
        <p aria-live="polite">{message}</p>
      </div>
      <input
        id={inputId}
        className={classPrefix + "-upload-input"}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={busy}
        onChange={(event) => void onFile(event)}
      />
      <label
        className={classPrefix + "-upload-button"}
        htmlFor={inputId}
        aria-disabled={busy}
        onClick={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        {busy
          ? "UPLOADING…"
          : status === "done"
            ? "UPLOAD ANOTHER"
            : "CHOOSE IMAGE"}
      </label>
    </section>
  );
}
