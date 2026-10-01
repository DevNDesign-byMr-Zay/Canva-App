import { upload } from "@canva/asset";
import { addElementAtPoint } from "@canva/design";

import { fetchBackendExportBlob } from "./export-client";

const MAX_CANVA_RENDER_BYTES = 20 * 1024 * 1024;

function blobToDataUrl(blob: Blob): Promise<string> {
  if (blob.size <= 0 || blob.size > MAX_CANVA_RENDER_BYTES) {
    throw new Error("HoloForge PNG render is empty or exceeds the 20 MB Canva insertion limit.");
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("HoloForge could not prepare the PNG render for Canva."));
    reader.onload = () => {
      if (typeof reader.result !== "string" || !reader.result.startsWith("data:image/png")) {
        reject(new Error("HoloForge render did not resolve to a PNG data URL."));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
}

export async function insertBackendPngIntoCanva(
  exportId: string,
  sceneName = "HoloForge Scene Render",
): Promise<string> {
  const artifact = await fetchBackendExportBlob(exportId);
  if (artifact.mimeType !== "image/png" && artifact.blob.type !== "image/png") {
    throw new Error("Only completed PNG still exports can be inserted into Canva.");
  }

  const dataUrl = await blobToDataUrl(artifact.blob);
  const asset = await upload({
    type: "image",
    url: dataUrl,
    thumbnailUrl: dataUrl,
    mimeType: "image/png",
    aiDisclosure: "none",
    name: sceneName,
  });
  await asset.whenUploaded();

  await addElementAtPoint({
    type: "image",
    ref: asset.ref,
    altText: {
      text: sceneName,
      decorative: false,
    },
  });

  return artifact.fileName;
}
