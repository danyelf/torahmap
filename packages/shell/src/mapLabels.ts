// The map's labels: each book's name at its top-right, and each section's name
// set sideways beside it. On the Talmud's map a book is a tractate and a
// section a seder.

import type { MapItem } from '@torahmap/engine';
import { HEBREW_LABEL_FONT, HEBREW_LABEL_SCALE } from './labelTypography.ts';

interface Box {
  minX: number;
  maxX: number;
  minY: number;
}

interface Pan {
  x: number;
  y: number;
}

/** A section's name, in Hebrew and in English. */
export interface SectionName {
  he: string;
  en: string;
}

const BASE_LABEL_GAP = 10; // Gap between label bottom and verse top at BASE_FONT_SIZE
const BASE_FONT_SIZE = 13; // Font size at zoom=1
const MIN_FONT_SIZE = 5; // Minimum font size when zoomed out
const MAX_FONT_SIZE = 50; // Maximum font size when zoomed in
// Below this screen width a book is too narrow for its English name as well.
const ENGLISH_MIN_BOOK_WIDTH_PX = 80;

/**
 * A text's section labels: their font size at zoom 1, and the gap between a
 * section and its label, in ems.
 *
 * The font has no minimum, so a label keeps its length on the map, and a text
 * picks a size at which its longest label is shorter than its shortest
 * section: then however far out the reader zooms, no label reaches the next
 * section. The Tanakh's longest is about 275 units at 32, against its shortest
 * section's 470.
 */
export interface SectionLabelSize {
  fontSize: number;
  gapEm: number;
}

// The Tanakh's.
const DEFAULT_SECTION_SIZE: SectionLabelSize = { fontSize: 32, gapEm: 0.5 };
const MAX_SECTION_FONT_SIZE = 64;
const SECTION_LABEL_LINE_EM = 1.2;

/**
 * How far right of its section a section label reaches, in map units, while
 * its font is still growing with the zoom.
 */
export function sectionLabelReach(size = DEFAULT_SECTION_SIZE): number {
  return size.fontSize * (size.gapEm + SECTION_LABEL_LINE_EM);
}

/** Only the Hebrew is scaled: the English beside it is a sans face and needs no correction. */
function hebrewSpan(text: string, className: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = className;
  span.style.fontFamily = HEBREW_LABEL_FONT;
  span.style.fontSize = `${HEBREW_LABEL_SCALE}em`;
  span.textContent = text;
  return span;
}

/** The box around each group of items, in the order the groups first appear. */
function boxesBy<T extends MapItem>(items: T[], groupOf: (item: T) => string): Map<string, Box> {
  const boxes = new Map<string, Box>();
  for (const v of items) {
    const group = groupOf(v);
    const b = boxes.get(group);
    if (!b) {
      boxes.set(group, { minX: v.x, maxX: v.x + v.size, minY: v.y });
      continue;
    }
    b.minX = Math.min(b.minX, v.x);
    b.maxX = Math.max(b.maxX, v.x + v.size);
    b.minY = Math.min(b.minY, v.y);
  }
  return boxes;
}

/**
 * A book label set as a tab inside its book's box, scaled with the map rather
 * than held to a readable size: its font size, how far above the book's first
 * row its top sits and how far in from its right edge, in map units, and the
 * smallest font, in pixels, it shows at. Smaller, it fades out.
 */
export interface BookTab {
  fontSize: number;
  above: number;
  inset: number;
  minPx: number;
}

const tabs = new WeakMap<HTMLElement, BookTab>();

/**
 * A book missing from `hebrewNames` shows its own name in the Hebrew's place.
 * Without `tab`, a label sits above its book at a size held between bounds.
 */
export function createBookLabels<T extends MapItem>(
  items: T[],
  container: HTMLElement,
  bookOf: (item: T) => string,
  hebrewNames: Record<string, string> = {},
  tab?: BookTab,
): HTMLDivElement {
  const labels = document.createElement('div');
  labels.id = 'book-labels';
  if (tab) tabs.set(labels, tab);

  for (const [name, pos] of boxesBy(items, bookOf)) {
    const label = document.createElement('div');
    label.className = 'book-label';
    label.style.cssText = `
      position:absolute;
      color:#eee;
      font-weight:700;
      text-shadow:0 1px 3px rgba(0,0,0,0.8);
      white-space:nowrap;
      /* A length, not a factor: the larger Hebrew below inherits it as-is and
         so cannot grow the box the positioning maths below assumes. */
      line-height:1.2em;
      transition:opacity 0.2s;
    `;
    label.dataset.bookName = name;
    label.dataset.rightX = String(pos.maxX);
    label.dataset.topY = String(pos.minY);
    label.dataset.bookWidth = String(pos.maxX - pos.minX);

    // Hebrew name, without nikkud
    label.appendChild(hebrewSpan(hebrewNames[name] ?? name, 'book-label-he'));

    // English name (shown when there's room)
    const enSpan = document.createElement('span');
    enSpan.className = 'book-label-en';
    enSpan.textContent = ` ${name}`;
    enSpan.style.cssText = 'font-family:system-ui,sans-serif;';
    label.appendChild(enSpan);

    labels.appendChild(label);
  }

  container.appendChild(labels);
  return labels;
}

/**
 * Adds a sideways heading to the right of each section's books, where Hebrew
 * reading starts. `labelsContainer` is what createBookLabels returned.
 */
export function createSectionLabels<T extends MapItem>(
  items: T[],
  labelsContainer: HTMLElement,
  sectionOf: (item: T) => string,
  names: Readonly<Record<string, SectionName>>,
  size = DEFAULT_SECTION_SIZE,
): void {
  for (const [section, b] of boxesBy(items, sectionOf)) {
    const label = document.createElement('div');
    label.style.cssText = `
      position:absolute;
      color:#aaa;
      font-weight:700;
      text-shadow:0 1px 3px rgba(0,0,0,0.8);
      white-space:nowrap;
      line-height:${SECTION_LABEL_LINE_EM}em;
    `;
    label.dataset.section = section;
    label.dataset.fontSize = String(size.fontSize);
    label.dataset.gapEm = String(size.gapEm);
    label.dataset.leftX = String(b.maxX);
    label.dataset.topY = String(b.minY);

    label.appendChild(hebrewSpan(names[section]?.he ?? section, 'section-label-he'));

    const enSpan = document.createElement('span');
    enSpan.style.fontFamily = 'system-ui,sans-serif';
    enSpan.textContent = ` ${names[section]?.en ?? ''}`;
    label.appendChild(enSpan);

    labelsContainer.appendChild(label);
  }
}

/** `bookLabelRise` is how far the book labels sit above their first row. */
function positionSectionLabel(
  label: HTMLElement,
  pan: Pan,
  zoom: number,
  bookLabelRise: number,
): void {
  const fontSize = Math.min(
    MAX_SECTION_FONT_SIZE,
    parseFloat(label.dataset.fontSize || '0') * zoom,
  );
  const gapEm = parseFloat(label.dataset.gapEm || '0');
  const leftX = parseFloat(label.dataset.leftX || '0');
  const topY = parseFloat(label.dataset.topY || '0');
  label.style.left = (leftX + pan.x) * zoom + fontSize * gapEm + 'px';
  label.style.top = (topY + pan.y) * zoom - bookLabelRise + 'px';
  label.style.fontSize = fontSize + 'px';
  // Turned clockwise about its own top-left corner, so the text reads downward
  // from the top of the book labels and its line box sits right of the anchor.
  label.style.transformOrigin = '0 0';
  label.style.transform = 'rotate(90deg) translateY(-100%)';
}

/**
 * A book label's font size at `zoom`, and how far above its book's first row
 * the label's top sits: its own height, then a gap that scales with the font.
 */
export function bookLabelSize(zoom: number): { fontSize: number; rise: number } {
  const fontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, BASE_FONT_SIZE * zoom));
  return { fontSize, rise: fontSize + BASE_LABEL_GAP * (fontSize / BASE_FONT_SIZE) };
}

export function updateLabelPositions(labelsContainer: HTMLElement, pan: Pan, zoom: number): void {
  const tab = tabs.get(labelsContainer);
  const { fontSize, rise } = tab
    ? { fontSize: tab.fontSize * zoom, rise: tab.above * zoom }
    : bookLabelSize(zoom);
  // A tab keeps its length on the map, so the room its English needs is in ems.
  const englishMinWidth = tab
    ? fontSize * (ENGLISH_MIN_BOOK_WIDTH_PX / BASE_FONT_SIZE)
    : ENGLISH_MIN_BOOK_WIDTH_PX;

  for (const label of labelsContainer.children) {
    if (label instanceof HTMLElement && label.dataset.section) {
      positionSectionLabel(label, pan, zoom, rise);
    } else if (label instanceof HTMLElement) {
      const rightX = parseFloat(label.dataset.rightX || '0');
      const topY = parseFloat(label.dataset.topY || '0');
      const bookWidth = parseFloat(label.dataset.bookWidth || '0');
      // Position at book's right edge, label extends leftward via translateX(-100%)
      const screenX = (rightX - (tab?.inset ?? 0) + pan.x) * zoom;
      const screenY = (topY + pan.y) * zoom - rise;
      label.style.left = screenX + 'px';
      label.style.top = screenY + 'px';
      label.style.fontSize = fontSize + 'px';
      label.style.transform = 'translateX(-100%)';

      const bookScreenWidth = bookWidth * zoom;
      label.classList.toggle('narrow', bookScreenWidth < englishMinWidth);
      if (tab) label.style.opacity = fontSize < tab.minPx ? '0' : '';
    }
  }
}
