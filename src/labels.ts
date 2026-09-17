// Render book labels as HTML overlays

import type { TanakhLayout } from './types.ts';
import { HEBREW_LABEL_SCALE } from './constants/app.ts';

interface BookBounds {
  minX: number;
  maxX: number;
  minY: number;
}

interface Pan {
  x: number;
  y: number;
}

const LABEL_LINE_HEIGHT = 1.2;
const BASE_LABEL_GAP = 10; // Gap between label bottom and verse top at BASE_FONT_SIZE
const BASE_FONT_SIZE = 13; // Font size at zoom=1
const MIN_FONT_SIZE = 5; // Minimum font size when zoomed out
const MAX_FONT_SIZE = 50; // Maximum font size when zoomed in
// Show English subtitle when book's screen width exceeds this many pixels
const ENGLISH_MIN_BOOK_WIDTH_PX = 80;

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
    label.style.cssText = `
      position:absolute;
      color:#eee;
      font-weight:700;
      text-shadow:0 1px 3px rgba(0,0,0,0.8);
      white-space:nowrap;
      line-height:${LABEL_LINE_HEIGHT};
    `;
    label.dataset.bookName = name;
    label.dataset.rightX = String(pos.maxX);
    label.dataset.topY = String(pos.minY);
    label.dataset.bookWidth = String(pos.maxX - pos.minX);

    // Hebrew name (always shown, without nikkud)
    const heSpan = document.createElement('span');
    heSpan.className = 'book-label-he';
    heSpan.style.fontFamily = '"David Libre", system-ui, sans-serif';
    // Only the Hebrew grows: the English beside it never changed typeface. The
    // line-height shrinks to match, so the taller Hebrew leaves the label box
    // the height the positioning maths assumes and the gap above the verses
    // stays where it was.
    heSpan.style.fontSize = `${HEBREW_LABEL_SCALE}em`;
    heSpan.style.lineHeight = String(LABEL_LINE_HEIGHT / HEBREW_LABEL_SCALE);
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

export function updateLabelPositions(labelsContainer: HTMLElement, pan: Pan, zoom: number): void {
  const fontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, BASE_FONT_SIZE * zoom));
  const gap = BASE_LABEL_GAP * (fontSize / BASE_FONT_SIZE);

  for (const label of labelsContainer.children) {
    if (label instanceof HTMLElement) {
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
      const enSpan = label.querySelector<HTMLElement>('.book-label-en');
      if (enSpan) {
        enSpan.style.display = bookScreenWidth >= ENGLISH_MIN_BOOK_WIDTH_PX ? '' : 'none';
      }
    }
  }
}
