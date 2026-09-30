import type { CreationType } from "./material-contract";

export type ForgeRoute = "APP_OWNED_EFFECT" | "DERIVED_IMAGE" | "HYBRID";

export type CreationForgeSupport = Readonly<{
  creationType: CreationType;
  route: ForgeRoute;
  forgeable: true;
  requiredSource: "none" | "text" | "image";
  reason: string;
}>;

const SUPPORT: Readonly<Record<CreationType, CreationForgeSupport>> = Object.freeze({
  holo_text: Object.freeze({
    creationType: "holo_text",
    route: "APP_OWNED_EFFECT",
    forgeable: true,
    requiredSource: "text",
    reason: "Enter the text you want to turn into a spectral holographic title.",
  }),
  holo_logo: Object.freeze({
    creationType: "holo_logo",
    route: "DERIVED_IMAGE",
    forgeable: true,
    requiredSource: "image",
    reason: "Choose an uploaded image or one selected in Canva to forge a holographic logo treatment.",
  }),
  holo_graphic: Object.freeze({
    creationType: "holo_graphic",
    route: "HYBRID",
    forgeable: true,
    requiredSource: "none",
    reason:
      "Without a source, HoloForge creates an editable spectral graphic. With a source image, it forges a derived holographic raster.",
  }),
  glass: Object.freeze({
    creationType: "glass",
    route: "APP_OWNED_EFFECT",
    forgeable: true,
    requiredSource: "none",
    reason: "Creates an editable refractive glass plate in Canva.",
  }),
  chrome: Object.freeze({
    creationType: "chrome",
    route: "APP_OWNED_EFFECT",
    forgeable: true,
    requiredSource: "none",
    reason: "Creates an editable holographic chrome plate in Canva.",
  }),
  light_fx: Object.freeze({
    creationType: "light_fx",
    route: "APP_OWNED_EFFECT",
    forgeable: true,
    requiredSource: "none",
    reason: "Creates an editable photonic light overlay in Canva.",
  }),
});

export function getCreationForgeSupport(creationType: CreationType): CreationForgeSupport {
  return SUPPORT[creationType];
}
