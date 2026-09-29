import { initAppElement } from "@canva/design";

import type { HolographicEffectPlan } from "./effect-plan";
import type { CreationType, MaterialFamily, MotionMode } from "./material-contract";

export type HolographicAppElementData = Readonly<{
  version: 1;
  creationType: CreationType;
  presetId: string;
  family: MaterialFamily;
  colorShift: number;
  reflection: number;
  glow: number;
  grain: number;
  angle: number;
  transparency: number;
  motionMode: MotionMode;
}>;

export type AppOwnedEffectAdapter = Readonly<{
  addEffect(data: HolographicAppElementData): Promise<void>;
}>;

const FAMILY_PALETTES: Readonly<Record<MaterialFamily, readonly [string, string, string, string]>> =
  Object.freeze({
    iridescent: ["#ffd36a", "#53e5ff", "#ba6cff", "#ff6dcf"],
    glass: ["#dff8ff", "#86d8ff", "#c6a6ff", "#ffffff"],
    foil: ["#ff6fd8", "#74f8ff", "#f8ff7a", "#9a7cff"],
    metal: ["#171922", "#c9d2e3", "#54dcff", "#7f5cff"],
    pearl: ["#fff4e8", "#d9f6ff", "#efd8ff", "#ffdce9"],
    neon: ["#00f0ff", "#7157ff", "#ff4fd8", "#07131c"],
    crystal: ["#e9fbff", "#79dfff", "#c4b1ff", "#ffffff"],
  });

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[char] ?? char);
}

export function renderHolographicSvg(data: HolographicAppElementData): string {
  const palette = FAMILY_PALETTES[data.family];
  const opacity = Number((1 - clamp(data.transparency) / 100).toFixed(3));
  const glow = Number(((clamp(data.glow) / 100) * 18).toFixed(2));
  const reflectionOpacity = Number(((clamp(data.reflection) / 100) * 0.72).toFixed(3));
  const grainOpacity = Number(((clamp(data.grain) / 100) * 0.18).toFixed(3));
  const shift = clamp(data.colorShift);
  const angle = Math.max(0, Math.min(360, data.angle));
  const title = escapeXml(data.presetId.replace(/-/g, " ").toUpperCase());

  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="holo" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(${angle} .5 .5)">
      <stop offset="0%" stop-color="${palette[0]}"/>
      <stop offset="${Math.max(18, 38 - shift / 4)}%" stop-color="${palette[1]}"/>
      <stop offset="${Math.min(78, 58 + shift / 5)}%" stop-color="${palette[2]}"/>
      <stop offset="100%" stop-color="${palette[3]}"/>
    </linearGradient>
    <radialGradient id="reflection" cx="72%" cy="22%" r="64%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="${reflectionOpacity}"/>
      <stop offset="48%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="fx" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="${glow}" result="blur"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="2" seed="${Math.round(shift + angle)}" result="noise"/>
      <feColorMatrix in="noise" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${grainOpacity} 0" result="grain"/>
      <feBlend in="SourceGraphic" in2="grain" mode="soft-light"/>
    </filter>
  </defs>
  <rect width="640" height="360" rx="36" fill="#07090f"/>
  <rect x="10" y="10" width="620" height="340" rx="30" fill="url(#holo)" opacity="${opacity}" filter="url(#fx)"/>
  <rect x="10" y="10" width="620" height="340" rx="30" fill="url(#reflection)"/>
  <path d="M32 278 C156 214 220 318 354 250 S534 164 616 210" fill="none" stroke="#ffffff" stroke-opacity="0.32" stroke-width="2"/>
  <text x="34" y="320" fill="#ffffff" fill-opacity="0.86" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="3">${title}</text>
</svg>`;
}

export function holographicSvgDataUrl(data: HolographicAppElementData): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderHolographicSvg(data))}`;
}

export function appElementDataFromPlan(
  plan: HolographicEffectPlan,
  family: MaterialFamily,
): HolographicAppElementData {
  return Object.freeze({
    version: 1,
    creationType: plan.creationType,
    presetId: plan.presetId,
    family,
    colorShift: plan.parameters.colorShift,
    reflection: plan.parameters.reflection,
    glow: plan.parameters.glow,
    grain: plan.parameters.grain,
    angle: plan.parameters.angle,
    transparency: plan.parameters.transparency,
    motionMode: plan.parameters.motionMode,
  });
}

const appElementClient = initAppElement<HolographicAppElementData>({
  render: (data) => [
    {
      type: "image",
      dataUrl: holographicSvgDataUrl(data),
      width: 640,
      height: 360,
      top: 0,
      left: 0,
      altText: {
        text: `HoloForge ${data.presetId.replace(/-/g, " ")} holographic effect`,
        decorative: false,
      },
    },
  ],
});

export const canvaAppOwnedEffectAdapter: AppOwnedEffectAdapter = Object.freeze({
  async addEffect(data) {
    await appElementClient.addElement({ data });
  },
});
