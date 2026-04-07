// Tractate name labels + daf labels for the Talmud map.
//
// Uses HTML div overlays positioned via pan/zoom (same approach as
// src/labels.ts for Tanakh book labels).
//
// Tractate labels are always visible; daf labels toggle by zoom level.

import type { TractateBlock } from "./layout.ts";
import { DAF_LABEL_ZOOM_LOW, DAF_LABEL_ZOOM_HIGH } from "./constants.ts";

const BASE_TRACTATE_FONT_SIZE = 12;
const MIN_TRACTATE_FONT_SIZE = 6;
const MAX_TRACTATE_FONT_SIZE = 36;

const DAF_LABEL_FONT_SIZE = 9;

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
  tractateLabels: HTMLDivElement;
  dafLabels: HTMLDivElement;
}

export function createTalmudLabels(
  tractateBlocks: TractateBlock[],
  dafRows: DafRowAnchor[],
  parent: HTMLElement,
): TalmudLabelState {
  const container = document.createElement("div");
  container.id = "talmud-labels";
  container.style.cssText = "position:fixed;top:0;left:0;pointer-events:none;width:0;height:0;";

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
    // Anchor at the tractate's label anchor (center-top of the block)
    label.dataset.worldX = String(block.labelAnchor.x);
    label.dataset.worldY = String(block.minY + 2);
    tractateLabels.appendChild(label);
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

  container.appendChild(tractateLabels);
  container.appendChild(dafLabelsEl);
  parent.appendChild(container);

  return { container, tractateLabels, dafLabels: dafLabelsEl };
}

export function updateTalmudLabelPositions(
  state: TalmudLabelState,
  pan: { x: number; y: number },
  zoom: number,
): void {
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

  // Daf labels: zoom-dependent density.
  //   zoom < LOW:  none
  //   LOW..HIGH:   every 10th daf
  //   zoom >= HIGH: all
  const showAll = zoom >= DAF_LABEL_ZOOM_HIGH;
  const showSparse = zoom >= DAF_LABEL_ZOOM_LOW;
  for (const el of Array.from(state.dafLabels.children) as HTMLElement[]) {
    const daf = parseInt(el.dataset.daf || "0", 10);
    const amud = el.dataset.amud;
    const shouldShow = showAll || (showSparse && amud === "a" && daf % 10 === 0);
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
