// The Talmud map's own marks: a tint behind each seder, and the perek and daf
// labels, which show by zoom level. Tractates and sedarim are named by the
// shell's map labels, as books and sections are on the Tanakh's.

import type { SederBlock, PerekAnchor, DafRowAnchor } from './layout.ts';
import {
  DAF_LABEL_ZOOM_ALL,
  PEREK_LABEL_ZOOM,
  SEDER_BACKGROUND_COLORS,
  SEDER_BACKGROUND_OPACITY,
} from './constants.ts';
import { HEBREW_LABEL_FONT, HEBREW_LABEL_SCALE } from '@torahmap/shell/labelTypography.ts';

// Size at zoom 1, and the bounds it is held between as the reader zooms.
interface LabelSize {
  base: number;
  min: number;
  max: number;
}

const PEREK_SIZE: LabelSize = { base: 9, min: 7, max: 18 };

const DAF_LABEL_FONT_SIZE = 9;

// Every Hebrew label scales with zoom between its own bounds, then takes the
// correction for the face it is set in.
const hebrewLabelFontSize = ({ base, min, max }: LabelSize, zoom: number) =>
  Math.max(min, Math.min(max, base * zoom)) * HEBREW_LABEL_SCALE;

export interface TalmudLabelState {
  container: HTMLDivElement;
  sederBackgrounds: HTMLDivElement;
  perekLabels: HTMLDivElement;
  dafLabels: HTMLDivElement;
}

export function createTalmudLabels(
  sederBlocks: SederBlock[],
  perekAnchors: PerekAnchor[],
  dafRows: DafRowAnchor[],
  parent: HTMLElement,
): TalmudLabelState {
  const container = document.createElement('div');
  container.id = 'talmud-labels';

  // --- Seder background tints (drawn first so labels and tractates layer on
  // top in DOM order). Each rect spans the full shelf in world space and is
  // positioned by updateTalmudLabelPositions.
  const sederBackgrounds = document.createElement('div');
  sederBackgrounds.id = 'talmud-seder-bgs';
  for (const sb of sederBlocks) {
    const tint = SEDER_BACKGROUND_COLORS[sb.name];
    if (!tint) continue;
    const rect = document.createElement('div');
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

  // Perek labels: each perek's name, above its first row, flush with its right edge.
  const perekLabels = document.createElement('div');
  perekLabels.id = 'talmud-perek-labels';
  for (const a of perekAnchors) {
    const label = document.createElement('div');
    label.style.cssText = `
      position:absolute;
      color:#cfd6e6;
      opacity:0.75;
      font-family:${HEBREW_LABEL_FONT};
      font-weight:600;
      text-shadow:0 1px 2px rgba(0,0,0,0.7);
      white-space:nowrap;
      line-height:1;
      direction:rtl;
      transform:translate(-100%, -100%);
      display:none;
    `;
    label.textContent = a.hebrewName;
    label.dataset.worldX = String(a.rightX);
    label.dataset.worldY = String(a.topY - 2);
    perekLabels.appendChild(label);
  }

  const dafLabelsEl = document.createElement('div');
  dafLabelsEl.id = 'talmud-daf-labels';

  for (const row of dafRows) {
    const label = document.createElement('div');
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
  container.appendChild(perekLabels);
  container.appendChild(dafLabelsEl);
  parent.appendChild(container);

  return {
    container,
    sederBackgrounds,
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
    const minX = parseFloat(el.dataset.minX || '0');
    const minY = parseFloat(el.dataset.minY || '0');
    const maxX = parseFloat(el.dataset.maxX || '0');
    const maxY = parseFloat(el.dataset.maxY || '0');
    const screenX = (minX + pan.x) * zoom;
    const screenY = (minY + pan.y) * zoom;
    const screenW = (maxX - minX) * zoom;
    const screenH = (maxY - minY) * zoom;
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
    el.style.width = `${screenW}px`;
    el.style.height = `${screenH}px`;
  }

  // Perek labels: scaled with zoom.
  const perekVisible = zoom >= PEREK_LABEL_ZOOM;
  const perekFontSize = hebrewLabelFontSize(PEREK_SIZE, zoom);
  for (const el of Array.from(state.perekLabels.children) as HTMLElement[]) {
    if (!perekVisible) {
      el.style.display = 'none';
      continue;
    }
    el.style.display = '';
    const worldX = parseFloat(el.dataset.worldX || '0');
    const worldY = parseFloat(el.dataset.worldY || '0');
    const screenX = (worldX + pan.x) * zoom;
    const screenY = (worldY + pan.y) * zoom;
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
    el.style.fontSize = `${perekFontSize}px`;
  }

  // Daf labels: every 3rd daf with the perek names (3a, 6a, 10a, 13a, …), every page from
  // DAF_LABEL_ZOOM_ALL.
  const showAll = zoom >= DAF_LABEL_ZOOM_ALL;
  const showSome = zoom >= PEREK_LABEL_ZOOM;
  for (const el of Array.from(state.dafLabels.children) as HTMLElement[]) {
    const daf = parseInt(el.dataset.daf || '0', 10);
    const m = daf % 10;
    const shouldShow =
      showAll || (showSome && el.dataset.amud === 'a' && (m === 3 || m === 6 || m === 0));
    if (!shouldShow) {
      el.style.display = 'none';
      continue;
    }
    el.style.display = '';
    const worldX = parseFloat(el.dataset.worldX || '0');
    const worldY = parseFloat(el.dataset.worldY || '0');
    const screenX = (worldX + pan.x) * zoom;
    const screenY = (worldY + pan.y) * zoom;
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
  }
}
