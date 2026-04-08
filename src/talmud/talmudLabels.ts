// Tractate name labels + daf labels for the Talmud map.
//
// Uses HTML div overlays positioned via pan/zoom (same approach as
// src/labels.ts for Tanakh book labels).
//
// Tractate labels are always visible; daf labels toggle by zoom level.

import type { TractateBlock, SederBlock, PerekAnchor } from "./layout.ts";
import {
  DAF_LABEL_ZOOM_LOW,
  DAF_LABEL_ZOOM_MID,
  DAF_LABEL_ZOOM_HIGH,
  SEDER_BACKGROUND_COLORS,
  SEDER_BACKGROUND_OPACITY,
} from "./constants.ts";

// Perek labels appear at mid-zoom and above (same threshold as the daf
// 3/3/4 tier — when the user can see individual sub-decade dapim, the
// perek headings become legible too).
const PEREK_LABEL_ZOOM_THRESHOLD = 0.7;
const BASE_PEREK_FONT_SIZE = 9;
const MIN_PEREK_FONT_SIZE = 7;
const MAX_PEREK_FONT_SIZE = 18;

const BASE_TRACTATE_FONT_SIZE = 12;
const MIN_TRACTATE_FONT_SIZE = 6;
const MAX_TRACTATE_FONT_SIZE = 36;

const BASE_SEDER_FONT_SIZE = 28;
const MIN_SEDER_FONT_SIZE = 14;
const MAX_SEDER_FONT_SIZE = 96;

const DAF_LABEL_FONT_SIZE = 9;

// Transliterated → Hebrew display fallback for seder names.
const SEDER_HEBREW: Record<string, string> = {
  "Seder Zeraim": "סדר זרעים",
  "Seder Moed": "סדר מועד",
  "Seder Nashim": "סדר נשים",
  "Seder Nezikin": "סדר נזיקין",
  "Seder Kodashim": "סדר קדשים",
  "Seder Tahorot": "סדר טהרות",
};

export interface DafRowAnchor {
  tractate: string;
  daf: number;
  amud: "a" | "b";
  // Right-edge x and top y of the row, in world coordinates.
  rightX: number;
  topY: number;
}

export interface TalmudLabelState {
  container: HTMLDivElement;
  sederBackgrounds: HTMLDivElement;
  sederLabels: HTMLDivElement;
  tractateLabels: HTMLDivElement;
  perekLabels: HTMLDivElement;
  dafLabels: HTMLDivElement;
}

export function createTalmudLabels(
  tractateBlocks: TractateBlock[],
  sederBlocks: SederBlock[],
  perekAnchors: PerekAnchor[],
  dafRows: DafRowAnchor[],
  parent: HTMLElement,
): TalmudLabelState {
  const container = document.createElement("div");
  container.id = "talmud-labels";
  container.style.cssText = "position:fixed;top:0;left:0;pointer-events:none;width:0;height:0;";

  // --- Seder background tints (drawn first so labels and tractates layer on
  // top in DOM order). Each rect spans the full shelf in world space and is
  // positioned by updateTalmudLabelPositions.
  const sederBackgrounds = document.createElement("div");
  sederBackgrounds.id = "talmud-seder-bgs";
  for (const sb of sederBlocks) {
    const tint = SEDER_BACKGROUND_COLORS[sb.name];
    if (!tint) continue;
    const rect = document.createElement("div");
    const r = Math.round(tint[0] * 255);
    const g = Math.round(tint[1] * 255);
    const b = Math.round(tint[2] * 255);
    rect.style.cssText = `
      position:absolute;
      background:rgba(${r},${g},${b},${SEDER_BACKGROUND_OPACITY});
      border-radius:4px;
    `;
    rect.dataset.minX = String(sb.minX);
    rect.dataset.minY = String(sb.minY);
    rect.dataset.maxX = String(sb.maxX);
    rect.dataset.maxY = String(sb.maxY);
    sederBackgrounds.appendChild(rect);
  }

  // --- Seder labels: large transliterated names, anchored to the right of
  // each shelf (RTL reading). Drawn at low opacity so they read as section
  // headings without dominating.
  const sederLabels = document.createElement("div");
  sederLabels.id = "talmud-seder-labels";
  for (const sb of sederBlocks) {
    const label = document.createElement("div");
    label.style.cssText = `
      position:absolute;
      color:#cfd6e6;
      opacity:0.55;
      font-family:"Noto Sans Hebrew", system-ui, sans-serif;
      font-weight:700;
      letter-spacing:0.04em;
      text-shadow:0 1px 4px rgba(0,0,0,0.7);
      white-space:nowrap;
      line-height:1;
      direction:rtl;
      transform:translate(0, -100%);
    `;
    const heb = SEDER_HEBREW[sb.name] ?? sb.name;
    label.textContent = heb;
    // Anchor at the right edge of the shelf (which is also the right edge of
    // the rightmost tractate, after the +dx world shift).
    label.dataset.worldX = String(sb.maxX);
    label.dataset.worldY = String(sb.minY);
    sederLabels.appendChild(label);
  }

  const tractateLabels = document.createElement("div");
  tractateLabels.id = "talmud-tractate-labels";

  for (const block of tractateBlocks) {
    const label = document.createElement("div");
    label.style.cssText = `
      position:absolute;
      color:#eee;
      font-family:"Noto Sans Hebrew", system-ui, sans-serif;
      font-weight:700;
      text-shadow:0 1px 3px rgba(0,0,0,0.8);
      white-space:nowrap;
      line-height:1;
      direction:rtl;
      transform:translate(-50%, -100%);
    `;
    label.textContent = block.hebrewName || block.name;
    // Anchor at the BOTTOM of the tractate label band (just above the
    // segments). With translate(-50%, -100%) this puts the label entirely
    // inside the seder background rect — which matches block.minY..maxY.
    // Anchoring at minY would put it ABOVE the seder bg, which is wrong.
    label.dataset.worldX = String(block.labelAnchor.x);
    label.dataset.worldY = String(block.labelAnchor.y + 6);
    tractateLabels.appendChild(label);
  }

  // --- Perek (section) labels: small Hebrew names of each perek,
  // centered above the perek's row block like a section title.
  // Visible at mid+ zoom.
  const perekLabels = document.createElement("div");
  perekLabels.id = "talmud-perek-labels";
  for (const a of perekAnchors) {
    const label = document.createElement("div");
    label.style.cssText = `
      position:absolute;
      color:#cfd6e6;
      opacity:0.75;
      font-family:"Noto Sans Hebrew", system-ui, sans-serif;
      font-weight:600;
      text-shadow:0 1px 2px rgba(0,0,0,0.7);
      white-space:nowrap;
      line-height:1;
      direction:rtl;
      transform:translate(-50%, -100%);
      display:none;
    `;
    label.textContent = a.hebrewName;
    // Center the label horizontally over the perek's content area
    // (the perek's max row width, anchored at the column's right edge).
    // worldX = horizontal center of the perek block.
    // worldY sits just above the first row.
    label.dataset.worldX = String(a.rightX - a.width / 2);
    label.dataset.worldY = String(a.topY - 2);
    perekLabels.appendChild(label);
  }

  const dafLabelsEl = document.createElement("div");
  dafLabelsEl.id = "talmud-daf-labels";

  for (const row of dafRows) {
    const label = document.createElement("div");
    label.style.cssText = `
      position:absolute;
      color:#888;
      font-family:system-ui, sans-serif;
      font-size:${DAF_LABEL_FONT_SIZE}px;
      white-space:nowrap;
      line-height:1;
      transform:translate(4px, 0);
      display:none;
    `;
    label.textContent = `${row.daf}${row.amud}`;
    label.dataset.worldX = String(row.rightX);
    label.dataset.worldY = String(row.topY);
    label.dataset.daf = String(row.daf);
    label.dataset.amud = row.amud;
    dafLabelsEl.appendChild(label);
  }

  container.appendChild(sederBackgrounds);
  container.appendChild(sederLabels);
  container.appendChild(tractateLabels);
  container.appendChild(perekLabels);
  container.appendChild(dafLabelsEl);
  parent.appendChild(container);

  return {
    container,
    sederBackgrounds,
    sederLabels,
    tractateLabels,
    perekLabels,
    dafLabels: dafLabelsEl,
  };
}

export function updateTalmudLabelPositions(
  state: TalmudLabelState,
  pan: { x: number; y: number },
  zoom: number,
): void {
  // Seder background rects: span the shelf in world space.
  for (const el of Array.from(state.sederBackgrounds.children) as HTMLElement[]) {
    const minX = parseFloat(el.dataset.minX || "0");
    const minY = parseFloat(el.dataset.minY || "0");
    const maxX = parseFloat(el.dataset.maxX || "0");
    const maxY = parseFloat(el.dataset.maxY || "0");
    const screenX = (minX + pan.x) * zoom;
    const screenY = (minY + pan.y) * zoom;
    const screenW = (maxX - minX) * zoom;
    const screenH = (maxY - minY) * zoom;
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
    el.style.width = `${screenW}px`;
    el.style.height = `${screenH}px`;
  }

  // Seder labels: always visible, large.
  const sederFontSize = Math.max(
    MIN_SEDER_FONT_SIZE,
    Math.min(MAX_SEDER_FONT_SIZE, BASE_SEDER_FONT_SIZE * zoom),
  );
  for (const el of Array.from(state.sederLabels.children) as HTMLElement[]) {
    const worldX = parseFloat(el.dataset.worldX || "0");
    const worldY = parseFloat(el.dataset.worldY || "0");
    const screenX = (worldX + pan.x) * zoom;
    const screenY = (worldY + pan.y) * zoom;
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
    el.style.fontSize = `${sederFontSize}px`;
  }

  // Tractate labels: always visible, scaled with zoom.
  const fontSize = Math.max(
    MIN_TRACTATE_FONT_SIZE,
    Math.min(MAX_TRACTATE_FONT_SIZE, BASE_TRACTATE_FONT_SIZE * zoom),
  );
  for (const el of Array.from(state.tractateLabels.children) as HTMLElement[]) {
    const worldX = parseFloat(el.dataset.worldX || "0");
    const worldY = parseFloat(el.dataset.worldY || "0");
    const screenX = (worldX + pan.x) * zoom;
    const screenY = (worldY + pan.y) * zoom;
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
    el.style.fontSize = `${fontSize}px`;
  }

  // Perek labels: visible at mid+ zoom, scaled with zoom.
  const perekVisible = zoom >= PEREK_LABEL_ZOOM_THRESHOLD;
  const perekFontSize = Math.max(
    MIN_PEREK_FONT_SIZE,
    Math.min(MAX_PEREK_FONT_SIZE, BASE_PEREK_FONT_SIZE * zoom),
  );
  for (const el of Array.from(state.perekLabels.children) as HTMLElement[]) {
    if (!perekVisible) {
      el.style.display = "none";
      continue;
    }
    el.style.display = "";
    const worldX = parseFloat(el.dataset.worldX || "0");
    const worldY = parseFloat(el.dataset.worldY || "0");
    const screenX = (worldX + pan.x) * zoom;
    const screenY = (worldY + pan.y) * zoom;
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
    el.style.fontSize = `${perekFontSize}px`;
  }

  // Daf labels: zoom-dependent density.
  //   zoom < LOW:  none
  //   LOW..MID:    every 10th daf, A side only ("10a", "20a", ...)
  //   MID..HIGH:   3/3/4 stride per decade ("3a", "6a", "10a",
  //                "13a", "16a", "20a", ...) — 10s stay visible
  //   zoom >= HIGH: every daf, both sides
  const showAll = zoom >= DAF_LABEL_ZOOM_HIGH;
  const showMid = zoom >= DAF_LABEL_ZOOM_MID;
  const showSparse = zoom >= DAF_LABEL_ZOOM_LOW;
  for (const el of Array.from(state.dafLabels.children) as HTMLElement[]) {
    const daf = parseInt(el.dataset.daf || "0", 10);
    const amud = el.dataset.amud;
    let shouldShow: boolean;
    if (showAll) {
      shouldShow = true;
    } else if (showMid) {
      // 3/3/4 stride: 3, 6, 10, 13, 16, 20, 23, 26, 30 ...
      const m = daf % 10;
      shouldShow = amud === "a" && (m === 3 || m === 6 || m === 0);
    } else if (showSparse) {
      shouldShow = amud === "a" && daf % 10 === 0;
    } else {
      shouldShow = false;
    }
    if (!shouldShow) {
      el.style.display = "none";
      continue;
    }
    el.style.display = "";
    const worldX = parseFloat(el.dataset.worldX || "0");
    const worldY = parseFloat(el.dataset.worldY || "0");
    const screenX = (worldX + pan.x) * zoom;
    const screenY = (worldY + pan.y) * zoom;
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
  }
}
