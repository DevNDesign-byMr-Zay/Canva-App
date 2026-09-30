import React, { useRef, useState } from "react";
import { upload } from "@canva/asset";
import { addElementAtPoint } from "@canva/design";

const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_RAW_BYTES = 7 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The selected image could not be read."));
    reader.onload = () => {
      if (typeof reader.result !== "string" || !reader.result.startsWith("data:")) {
        reject(new Error("The selected image could not be converted for Canva upload."));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export type LocalImageUploadProps = Readonly<{
  productName: string;
  classPrefix: "hf" | "dp";
  onUploaded?: () => void;
}>;

export function LocalImageUpload({
  productName,
  classPrefix,
  onUploaded,
}: LocalImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "uploading" | "adding" | "done" | "error">("idle");
  const [message, setMessage] = useState("Upload a local PNG, JPEG, or WebP test image.");
  const busy = status === "reading" || status === "uploading" || status === "adding";

  const chooseFile = () => inputRef.current?.click();

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    if (!ACCEPTED_TYPES.has(file.type)) {
      setStatus("error");
      setMessage("Use a PNG, JPEG, or WebP image for Canva testing.");
      return;
    }
    if (file.size <= 0 || file.size > MAX_RAW_BYTES) {
      setStatus("error");
      setMessage("Use a non-empty image up to 7 MB for direct Canva test upload.");
      return;
    }

    try {
      setStatus("reading");
      setMessage("Preparing the local image…");
      const dataUrl = await readAsDataUrl(file);

      setStatus("uploading");
      setMessage("Uploading to your Canva media library…");
      const asset = await upload({
        type: "image",
        mimeType: file.type as "image/png" | "image/jpeg" | "image/webp",
        url: dataUrl,
        thumbnailUrl: dataUrl,
        aiDisclosure: "none",
      });
      await asset.whenUploaded();

      setStatus("adding");
      setMessage("Adding the uploaded image to the current Canva design…");
      await addElementAtPoint({
        type: "image",
        ref: asset.ref,
        altText: {
          text: productName + " test image",
          decorative: false,
        },
      });

      setStatus("done");
      setMessage("Test image added to Canva. Select it to continue testing.");
      onUploaded?.();
    } catch (cause) {
      setStatus("error");
      setMessage(cause instanceof Error ? cause.message : "The Canva test image upload failed.");
    }
  };

  return (
    <section className={classPrefix + "-upload-card"} aria-label={productName + " test upload"}>
      <div className={classPrefix + "-upload-copy"}>
        <span className={classPrefix + "-upload-kicker"}>TEST SOURCE</span>
        <strong>Upload image to Canva</strong>
        <p>{message}</p>
      </div>
      <input
        ref={inputRef}
        className={classPrefix + "-upload-input"}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => void onFile(event)}
      />
      <button
        className={classPrefix + "-upload-button"}
        type="button"
        disabled={busy}
        onClick={chooseFile}
      >
        {busy ? "UPLOADING…" : status === "done" ? "UPLOAD ANOTHER" : "UPLOAD TEST IMAGE"}
      </button>
    </section>
  );
}
