// Render book labels as HTML overlays

import type { TanakhLayout } from './types.ts';
import { HEBREW_LABEL_FONT, HEBREW_LABEL_SCALE } from './constants/labels.ts';

interface BookBounds {
  minX: number;
  maxX: number;
  minY: number;
}

interface Pan {
  x: number;
  y: number;
}

const BASE_LABEL_GAP = 10; // Gap between label bottom and verse top at BASE_FONT_SIZE
const BASE_FONT_SIZE = 13; // Font size at zoom=1
const MIN_FONT_SIZE = 5; // Minimum font size when zoomed out
const MAX_FONT_SIZE = 50; // Maximum font size when zoomed in
// Below this screen width a book is too narrow for its English name as well.
const ENGLISH_MIN_BOOK_WIDTH_PX = 80;

// No minimum: a label keeps its length on the map, about 275 units against the
// shortest section's 470, so however far out it never reaches the next one.
const BASE_SECTION_FONT_SIZE = 32;
const MAX_SECTION_FONT_SIZE = 64;
const SECTION_LABEL_GAP_EM = 0.5;

export function createBookLabels(
  verses: TanakhLayout[],
  container: HTMLElement,
  hebrewNames?: Record<string, string>,
): HTMLDivElement {
  const books: Record<string, BookBounds> = {};
  for (const v of verses) {
    if (!books[v.book]) {
      books[v.book] = { minX: v.x, maxX: v.x + v.size, minY: v.y };
    }
    books[v.book].minX = Math.min(books[v.book].minX, v.x);
    books[v.book].maxX = Math.max(books[v.book].maxX, v.x + v.size);
    books[v.book].minY = Math.min(books[v.book].minY, v.y);
  }

  const labels = document.createElement('div');
  labels.id = 'book-labels';
  labels.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;';

  for (const [name, pos] of Object.entries(books)) {
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
    `;
    label.dataset.bookName = name;
    label.dataset.rightX = String(pos.maxX);
    label.dataset.topY = String(pos.minY);
    label.dataset.bookWidth = String(pos.maxX - pos.minX);

    // Hebrew name, without nikkud
    const heSpan = document.createElement('span');
    heSpan.className = 'book-label-he';
    heSpan.style.fontFamily = HEBREW_LABEL_FONT;
    // Only the Hebrew: the English sibling is a sans face and needs no correction.
    heSpan.style.fontSize = `${HEBREW_LABEL_SCALE}em`;
    heSpan.textContent = hebrewNames?.[name] ?? name;
    label.appendChild(heSpan);

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

type Section = 'torah' | 'neviim' | 'ketuvim';

const SECTION_NAMES: Record<Section, { he: string; en: string }> = {
  torah: { he: 'תורה', en: 'Five Books' },
  neviim: { he: 'נביאים', en: 'Prophets' },
  ketuvim: { he: 'כתובים', en: 'Writings' },
};

/**
 * Adds a sideways heading to the right of each section's row of books, where
 * Hebrew reading starts.
 */
export function createSectionLabels(
  verses: TanakhLayout[],
  labelsContainer: HTMLElement,
  sectionOf: (book: string) => Section,
): void {
  const bounds = new Map<Section, { maxX: number; minY: number }>();
  for (const v of verses) {
    const section = sectionOf(v.book);
    const b = bounds.get(section);
    if (!b) {
      bounds.set(section, { maxX: v.x + v.size, minY: v.y });
      continue;
    }
    b.maxX = Math.max(b.maxX, v.x + v.size);
    b.minY = Math.min(b.minY, v.y);
  }

  for (const [section, b] of bounds) {
    const label = document.createElement('div');
    label.style.cssText = `
      position:absolute;
      color:#aaa;
      font-weight:700;
      text-shadow:0 1px 3px rgba(0,0,0,0.8);
      white-space:nowrap;
      line-height:1.2em;
    `;
    label.dataset.section = section;
    label.dataset.leftX = String(b.maxX);
    label.dataset.topY = String(b.minY);

    const heSpan = document.createElement('span');
    heSpan.className = 'section-label-he';
    heSpan.style.fontFamily = HEBREW_LABEL_FONT;
    heSpan.style.fontSize = `${HEBREW_LABEL_SCALE}em`;
    heSpan.textContent = SECTION_NAMES[section].he;
    label.appendChild(heSpan);

    const enSpan = document.createElement('span');
    enSpan.style.fontFamily = 'system-ui,sans-serif';
    enSpan.textContent = ` ${SECTION_NAMES[section].en}`;
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
  const fontSize = Math.min(MAX_SECTION_FONT_SIZE, BASE_SECTION_FONT_SIZE * zoom);
  const leftX = parseFloat(label.dataset.leftX || '0');
  const topY = parseFloat(label.dataset.topY || '0');
  label.style.left = (leftX + pan.x) * zoom + fontSize * SECTION_LABEL_GAP_EM + 'px';
  label.style.top = (topY + pan.y) * zoom - bookLabelRise + 'px';
  label.style.fontSize = fontSize + 'px';
  // Turned clockwise about its own top-left corner, so the text reads downward
  // from the top of the book labels and its line box sits right of the anchor.
  label.style.transformOrigin = '0 0';
  label.style.transform = 'rotate(90deg) translateY(-100%)';
}

export function updateLabelPositions(labelsContainer: HTMLElement, pan: Pan, zoom: number): void {
  const fontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, BASE_FONT_SIZE * zoom));
  const gap = BASE_LABEL_GAP * (fontSize / BASE_FONT_SIZE);

  for (const label of labelsContainer.children) {
    if (label instanceof HTMLElement && label.dataset.section) {
      positionSectionLabel(label, pan, zoom, fontSize + gap);
    } else if (label instanceof HTMLElement) {
      const rightX = parseFloat(label.dataset.rightX || '0');
      const topY = parseFloat(label.dataset.topY || '0');
      const bookWidth = parseFloat(label.dataset.bookWidth || '0');
      // Position at book's right edge, label extends leftward via translateX(-100%)
      const screenX = (rightX + pan.x) * zoom;
      // Position so the gap from label bottom to verse top scales with font size
      const screenY = (topY + pan.y) * zoom - fontSize - gap;
      label.style.left = screenX + 'px';
      label.style.top = screenY + 'px';
      label.style.fontSize = fontSize + 'px';
      label.style.transform = 'translateX(-100%)';

      const bookScreenWidth = bookWidth * zoom;
      label.classList.toggle('narrow', bookScreenWidth < ENGLISH_MIN_BOOK_WIDTH_PX);
    }
  }
}
