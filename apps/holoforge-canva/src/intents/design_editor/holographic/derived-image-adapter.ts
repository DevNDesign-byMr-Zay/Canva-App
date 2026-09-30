import { getTemporaryUrl, type ImageRef, upload } from "@canva/asset";
import { addElementAtPoint } from "@canva/design";

import type { HolographicEffectPlan } from "./effect-plan";

export type HolographicRasterResult = Readonly<{
  ref: ImageRef;
  mimeType: "image/png";
}>;

export type DerivedImageAdapter = Readonly<{
  addDerivedEffect(plan: HolographicEffectPlan): Promise<HolographicRasterResult>;
}>;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function hueToRgb(hue: number): readonly [number, number, number] {
  const h = ((hue % 360) + 360) % 360;
  const c = 1;
  const x = 1 - Math.abs(((h / 60) % 2) - 1);
  let rgb: [number, number, number];

  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return rgb;
}

function deterministicNoise(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

export function applyHolographicPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  plan: Pick<HolographicEffectPlan, "parameters" | "creationType">,
): void {
  if (width <= 0 || height <= 0 || pixels.length < width * height * 4) {
    throw new Error("Invalid raster dimensions for HoloForge.");
  }

  const p = plan.parameters;
  const colorMix = clamp01(p.colorShift / 100) * (plan.creationType === "holo_logo" ? 0.78 : 0.62);
  const reflect = clamp01(p.reflection / 100);
  const glow = clamp01(p.glow / 100);
  const grain = clamp01(p.grain / 100);
  const depth = clamp01(p.depth / 100);
  const opacity = 1 - clamp01(p.transparency / 100);
  const angle = (p.angle * Math.PI) / 180;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const denom = Math.max(1, Math.abs(dx) * Math.max(1, width - 1) + Math.abs(dy) * Math.max(1, height - 1));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = pixels[index + 3];
      if (alpha === 0) continue;

      const r = pixels[index] / 255;
      const g = pixels[index + 1] / 255;
      const b = pixels[index + 2] / 255;
      const luminance = clamp01(0.2126 * r + 0.7152 * g + 0.0722 * b);
      const projection = ((x * dx + y * dy) / denom + 1) * 0.5;
      const spectralPhase = projection * (360 + p.colorShift * 2.1) + luminance * 110 + p.angle;
      const [sr, sg, sb] = hueToRgb(spectralPhase);

      const band = Math.pow(Math.max(0, Math.sin((projection * 5.5 + 0.12) * Math.PI)), 10);
      const specular = reflect * band * (0.28 + luminance * 0.48);
      const depthBoost = 0.78 + depth * 0.42;
      const glowLift = glow * (0.04 + luminance * 0.10);
      const noise = deterministicNoise(x, y) * grain * 0.075;

      const tintR = sr * (0.45 + luminance * 0.55);
      const tintG = sg * (0.45 + luminance * 0.55);
      const tintB = sb * (0.45 + luminance * 0.55);

      const outR = clamp01((r * (1 - colorMix) + tintR * colorMix) * depthBoost + specular + glowLift + noise);
      const outG = clamp01((g * (1 - colorMix) + tintG * colorMix) * depthBoost + specular + glowLift + noise);
      const outB = clamp01((b * (1 - colorMix) + tintB * colorMix) * depthBoost + specular + glowLift + noise);

      pixels[index] = Math.round(outR * 255);
      pixels[index + 1] = Math.round(outG * 255);
      pixels[index + 2] = Math.round(outB * 255);
      pixels[index + 3] = Math.round(alpha * opacity);
    }
  }
}

async function loadImage(url: string): Promise<Readonly<{ image: HTMLImageElement; objectUrl: string }>> {
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) {
    throw new Error(`Could not download the Canva source image (HTTP ${response.status}).`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  const image = new Image();
  image.crossOrigin = "anonymous";
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The Canva source image could not be decoded."));
      image.src = objectUrl;
    });
  } catch (cause) {
    URL.revokeObjectURL(objectUrl);
    throw cause;
  }
  return Object.freeze({ image, objectUrl });
}

function fitWithin(width: number, height: number, maxPixels = 4_000_000, maxSide = 2400) {
  const sideScale = Math.min(1, maxSide / Math.max(width, height));
  const pixelScale = Math.min(1, Math.sqrt(maxPixels / Math.max(1, width * height)));
  const scale = Math.min(sideScale, pixelScale);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function renderHolographicRaster(
  sourceRef: ImageRef,
  plan: HolographicEffectPlan,
): Promise<string> {
  const { url } = await getTemporaryUrl({ type: "image", ref: sourceRef });
  const loaded = await loadImage(url);
  try {
    const { image } = loaded;
    const fitted = fitWithin(image.naturalWidth || image.width, image.naturalHeight || image.height);

    const canvas = document.createElement("canvas");
    canvas.width = fitted.width;
    canvas.height = fitted.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("HoloForge could not initialize its raster material engine.");

    ctx.clearRect(0, 0, fitted.width, fitted.height);
    ctx.drawImage(image, 0, 0, fitted.width, fitted.height);
    const imageData = ctx.getImageData(0, 0, fitted.width, fitted.height);
    applyHolographicPixels(imageData.data, fitted.width, fitted.height, plan);
    ctx.putImageData(imageData, 0, 0);

    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(loaded.objectUrl);
  }
}

export const canvaDerivedImageAdapter: DerivedImageAdapter = Object.freeze({
  async addDerivedEffect(plan) {
    const sourceRef = plan.sourceImageRef;
    if (!sourceRef) {
      throw new Error("Choose or upload an image source before forging this hologram.");
    }

    const dataUrl = await renderHolographicRaster(sourceRef, plan);
    const asset = await upload({
      type: "image",
      parentRef: sourceRef,
      url: dataUrl,
      thumbnailUrl: dataUrl,
      mimeType: "image/png",
      aiDisclosure: "none",
      name: `HoloForge - ${plan.presetName}`,
    });
    await asset.whenUploaded();

    await addElementAtPoint({
      type: "image",
      ref: asset.ref,
      altText: {
        text: `HoloForge ${plan.creationType.replaceAll("_", " ")} using ${plan.presetName}`,
        decorative: false,
      },
    });

    return Object.freeze({ ref: asset.ref, mimeType: "image/png" as const });
  },
});
