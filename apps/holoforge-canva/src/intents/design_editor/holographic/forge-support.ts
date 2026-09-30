import type { CreationType } from "./material-contract";

export type ForgeRoute = "APP_OWNED_EFFECT" | "PREVIEW_ONLY";

export type CreationForgeSupport = Readonly<{
  creationType: CreationType;
  route: ForgeRoute;
  forgeable: boolean;
  reason: string;
}>;

const SUPPORT: Readonly<Record<CreationType, CreationForgeSupport>> = Object.freeze({
  holo_text: Object.freeze({
    creationType: "holo_text",
    route: "PREVIEW_ONLY",
    forgeable: false,
    reason: "Holo Text needs a trusted source-text binding before HoloForge can forge it safely.",
  }),
  holo_logo: Object.freeze({
    creationType: "holo_logo",
    route: "PREVIEW_ONLY",
    forgeable: false,
    reason: "Holo Logo needs a trusted source-logo binding before HoloForge can forge it safely.",
  }),
  holo_graphic: Object.freeze({
    creationType: "holo_graphic",
    route: "APP_OWNED_EFFECT",
    forgeable: true,
    reason: "Creates an editable HoloForge app element in Canva.",
  }),
  glass: Object.freeze({
    creationType: "glass",
    route: "APP_OWNED_EFFECT",
    forgeable: true,
    reason: "Creates an editable HoloForge glass app element in Canva.",
  }),
  chrome: Object.freeze({
    creationType: "chrome",
    route: "APP_OWNED_EFFECT",
    forgeable: true,
    reason: "Creates an editable HoloForge chrome app element in Canva.",
  }),
  light_fx: Object.freeze({
    creationType: "light_fx",
    route: "APP_OWNED_EFFECT",
    forgeable: true,
    reason: "Creates an editable HoloForge light-effect app element in Canva.",
  }),
});

export function getCreationForgeSupport(creationType: CreationType): CreationForgeSupport {
  return SUPPORT[creationType];
}
