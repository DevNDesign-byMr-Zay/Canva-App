import { initAppElement } from "@canva/design";

import type { HolographicEffectPlan } from "./effect-plan";
import type { CreationType, MaterialFamily, MotionMode } from "./material-contract";

export type HolographicAppElementData = Readonly<{
  version: 2;
  creationType: CreationType;
  presetId: string;
  family: MaterialFamily;
  colorShift: number;
  depth: number;
  reflection: number;
  glow: number;
  grain: number;
  angle: number;
  transparency: number;
  motionMode: MotionMode;
  sourceText?: string;
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
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[char] ?? char,
  );
}

function textMarkup(data: HolographicAppElementData): string {
  const raw = (data.sourceText?.trim() || "HOLOFORGE").slice(0, 96);
  const text = escapeXml(raw);
  const fontSize = Math.max(44, Math.min(116, Math.round(560 / Math.max(4, raw.length) * 4.2)));
  const depthOffset = Math.round(2 + (clamp(data.depth) / 100) * 12);
  return `
  <g transform="translate(320 180)" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="${fontSize}" font-weight="900" letter-spacing="4">
    <text x="${depthOffset}" y="${depthOffset}" dominant-baseline="middle" fill="#160c2e" opacity=".72">${text}</text>
    <text x="0" y="0" dominant-baseline="middle" fill="url(#holo)" stroke="#ffffff" stroke-opacity=".58" stroke-width="1.6" filter="url(#textGlow)">${text}</text>
    <text x="0" y="-2" dominant-baseline="middle" fill="none" stroke="url(#reflectionStroke)" stroke-width="2" opacity=".72">${text}</text>
  </g>`;
}

function glassMarkup(opacity: number): string {
  return `
  <rect x="28" y="28" width="584" height="304" rx="42" fill="url(#glassFill)" opacity="${opacity}" stroke="#ffffff" stroke-opacity=".52" stroke-width="2"/>
  <path d="M66 84 C180 32 332 38 552 106" fill="none" stroke="#ffffff" stroke-opacity=".52" stroke-width="5"/>
  <path d="M90 282 C236 232 378 304 562 234" fill="none" stroke="url(#holo)" stroke-opacity=".62" stroke-width="3"/>
  <circle cx="488" cy="92" r="54" fill="url(#reflection)" opacity=".76"/>`;
}

function chromeMarkup(opacity: number): string {
  return `
  <rect width="640" height="360" rx="38" fill="#06070b"/>
  <rect x="18" y="18" width="604" height="324" rx="32" fill="url(#chrome)" opacity="${opacity}" stroke="#dffcff" stroke-opacity=".46" stroke-width="2"/>
  <path d="M30 226 C122 122 202 292 320 172 S512 108 614 198" fill="none" stroke="url(#holo)" stroke-width="28" stroke-opacity=".34" filter="url(#softGlow)"/>
  <path d="M42 72 L598 72" stroke="#ffffff" stroke-width="5" stroke-opacity=".58"/>`;
}

function lightFxMarkup(): string {
  return `
  <g filter="url(#softGlow)">
    <ellipse cx="320" cy="180" rx="206" ry="72" fill="none" stroke="url(#holo)" stroke-width="12" opacity=".68"/>
    <ellipse cx="320" cy="180" rx="136" ry="40" fill="none" stroke="#ffffff" stroke-width="3" opacity=".66"/>
    <path d="M42 278 L304 186 L596 70" fill="none" stroke="url(#holo)" stroke-width="18" stroke-linecap="round" opacity=".54"/>
    <circle cx="320" cy="180" r="22" fill="#ffffff" opacity=".88"/>
  </g>`;
}

function graphicMarkup(opacity: number): string {
  return `
  <rect width="640" height="360" rx="36" fill="#07090f"/>
  <path d="M82 278 L188 82 L320 142 L446 64 L566 258 L392 302 L250 250 Z" fill="url(#holo)" opacity="${opacity}" filter="url(#fx)"/>
  <path d="M82 278 L188 82 L320 142 L446 64 L566 258" fill="none" stroke="#ffffff" stroke-opacity=".58" stroke-width="2"/>
  <path d="M74 230 C188 160 246 294 356 226 S516 146 596 190" fill="none" stroke="url(#reflectionStroke)" stroke-width="7" stroke-opacity=".56"/>`;
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

  const content =
    data.creationType === "holo_text"
      ? textMarkup(data)
      : data.creationType === "glass"
        ? glassMarkup(opacity)
        : data.creationType === "chrome"
          ? chromeMarkup(opacity)
          : data.creationType === "light_fx"
            ? lightFxMarkup()
            : graphicMarkup(opacity);

  const transparentBackground =
    data.creationType === "holo_text" || data.creationType === "light_fx";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="holo" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(${angle} .5 .5)">
      <stop offset="0%" stop-color="${palette[0]}"/>
      <stop offset="${Math.max(18, 38 - shift / 4)}%" stop-color="${palette[1]}"/>
      <stop offset="${Math.min(78, 58 + shift / 5)}%" stop-color="${palette[2]}"/>
      <stop offset="100%" stop-color="${palette[3]}"/>
    </linearGradient>
    <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#090b10"/>
      <stop offset=".18" stop-color="#f5fbff"/>
      <stop offset=".34" stop-color="#343945"/>
      <stop offset=".56" stop-color="#e9f8ff"/>
      <stop offset=".76" stop-color="#151924"/>
      <stop offset="1" stop-color="#858fa5"/>
    </linearGradient>
    <linearGradient id="glassFill" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette[0]}" stop-opacity=".42"/>
      <stop offset=".5" stop-color="${palette[2]}" stop-opacity=".18"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity=".30"/>
    </linearGradient>
    <linearGradient id="reflectionStroke" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${palette[0]}" stop-opacity="0"/>
      <stop offset=".48" stop-color="#ffffff" stop-opacity="${reflectionOpacity}"/>
      <stop offset="1" stop-color="${palette[3]}" stop-opacity="0"/>
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
    <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="${Math.max(2, glow * .55)}"/>
    </filter>
    <filter id="textGlow" x="-30%" y="-80%" width="160%" height="260%">
      <feGaussianBlur stdDeviation="${Math.max(.5, glow * .12)}" result="g"/>
      <feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  ${transparentBackground ? "" : '<rect width="640" height="360" rx="36" fill="#07090f" opacity=".96"/>'}
  ${content}
  ${data.creationType === "holo_text" ? "" : `<text x="34" y="328" fill="#ffffff" fill-opacity="0.72" font-family="Arial, sans-serif" font-size="14" font-weight="700" letter-spacing="2">${title}</text>`}
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
    version: 2,
    creationType: plan.creationType,
    presetId: plan.presetId,
    family,
    colorShift: plan.parameters.colorShift,
    depth: plan.parameters.depth,
    reflection: plan.parameters.reflection,
    glow: plan.parameters.glow,
    grain: plan.parameters.grain,
    angle: plan.parameters.angle,
    transparency: plan.parameters.transparency,
    motionMode: plan.parameters.motionMode,
    sourceText: plan.sourceText,
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
        text:
          data.creationType === "holo_text"
            ? `HoloForge holographic text: ${data.sourceText || "HOLOFORGE"}`
            : `HoloForge ${data.presetId.replace(/-/g, " ")} ${data.creationType.replaceAll("_", " ")}`,
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
