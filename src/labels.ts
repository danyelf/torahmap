// Render book labels as HTML overlays

import type { VerseLayout } from "./types.ts";
import { BOOK_HEBREW_NAMES } from "./constants/books.ts";

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
// Show English subtitle when book's screen width exceeds this many pixels
const ENGLISH_MIN_BOOK_WIDTH_PX = 80;

export function createBookLabels(
  verses: VerseLayout[],
  container: HTMLElement,
): HTMLDivElement {
  // Group verses by book to find column positions
  const books: Record<string, BookBounds> = {};
  for (const v of verses) {
    if (!books[v.book]) {
      books[v.book] = { minX: v.x, maxX: v.x + v.size, minY: v.y };
    }
    books[v.book].maxX = Math.max(books[v.book].maxX, v.x + v.size);
    books[v.book].minY = Math.min(books[v.book].minY, v.y);
  }

  const labels = document.createElement("div");
  labels.id = "book-labels";
  labels.style.cssText = "position:fixed;top:0;left:0;pointer-events:none;";

  for (const [name, pos] of Object.entries(books)) {
    const label = document.createElement("div");
    label.style.cssText = `
      position:absolute;
      color:#eee;
      font-weight:700;
      text-shadow:0 1px 3px rgba(0,0,0,0.8);
      white-space:nowrap;
      line-height:1.2;
    `;
    label.dataset.bookName = name;
    label.dataset.leftX = String(pos.minX);
    label.dataset.topY = String(pos.minY);
    label.dataset.bookWidth = String(pos.maxX - pos.minX);

    // Hebrew name (always shown)
    const heSpan = document.createElement("span");
    heSpan.className = "book-label-he";
    heSpan.textContent = BOOK_HEBREW_NAMES[name] || name;
    heSpan.style.fontFamily = "serif";
    label.appendChild(heSpan);

    // English name (shown when there's room)
    const enSpan = document.createElement("span");
    enSpan.className = "book-label-en";
    enSpan.textContent = ` ${name}`;
    enSpan.style.cssText = "font-family:sans-serif;opacity:0.7;";
    label.appendChild(enSpan);

    labels.appendChild(label);
  }

  container.appendChild(labels);
  return labels;
}

export function updateLabelPositions(
  labelsContainer: HTMLElement,
  pan: Pan,
  zoom: number,
): void {
  // Scale font size with zoom, clamped to prevent extremes
  const fontSize = Math.max(
    MIN_FONT_SIZE,
    Math.min(MAX_FONT_SIZE, BASE_FONT_SIZE * zoom),
  );

  // Scale gap proportionally to font size
  const gap = BASE_LABEL_GAP * (fontSize / BASE_FONT_SIZE);

  for (const label of labelsContainer.children) {
    if (label instanceof HTMLElement) {
      const leftX = parseFloat(label.dataset.leftX || "0");
      const topY = parseFloat(label.dataset.topY || "0");
      const bookWidth = parseFloat(label.dataset.bookWidth || "0");
      const screenX = (leftX + pan.x) * zoom;
      // Position so the gap from label bottom to verse top scales with font size
      const screenY = (topY + pan.y) * zoom - fontSize - gap;
      label.style.left = screenX + "px";
      label.style.top = screenY + "px";
      label.style.fontSize = fontSize + "px";

      // Show English name only when the book is wide enough on screen
      const bookScreenWidth = bookWidth * zoom;
      const enSpan = label.querySelector<HTMLElement>(".book-label-en");
      if (enSpan) {
        enSpan.style.display = bookScreenWidth >= ENGLISH_MIN_BOOK_WIDTH_PX ? "" : "none";
      }
    }
  }
}
