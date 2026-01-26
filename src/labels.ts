// Render book labels as HTML overlays

import type { VerseLayout } from './types.ts';

interface BookBounds {
  minX: number;
  maxX: number;
  minY: number;
}

interface Pan {
  x: number;
  y: number;
}

const LABEL_OFFSET_Y = -20; // Position labels above the book

export function createBookLabels(verses: VerseLayout[], container: HTMLElement): HTMLDivElement {
  // Group verses by book to find column positions
  const books: Record<string, BookBounds> = {};
  for (const v of verses) {
    if (!books[v.book]) {
      books[v.book] = { minX: v.x, maxX: v.x + v.size, minY: v.y };
    }
    books[v.book].maxX = Math.max(books[v.book].maxX, v.x + v.size);
    books[v.book].minY = Math.min(books[v.book].minY, v.y);
  }

  const labels = document.createElement('div');
  labels.id = 'book-labels';
  labels.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;';

  for (const [name, pos] of Object.entries(books)) {
    const label = document.createElement('div');
    label.textContent = name;
    label.style.cssText = `
      position:absolute;
      color:#eee;
      font-family:sans-serif;
      font-size:13px;
      font-weight:700;
      text-shadow:0 1px 3px rgba(0,0,0,0.8);
      white-space:nowrap;
    `;
    label.dataset.bookName = name;
    label.dataset.leftX = String(pos.minX);
    label.dataset.topY = String(pos.minY);
    labels.appendChild(label);
  }

  container.appendChild(labels);
  return labels;
}

export function updateLabelPositions(labelsContainer: HTMLElement, pan: Pan, zoom: number): void {
  for (const label of labelsContainer.children) {
    if (label instanceof HTMLElement) {
      const leftX = parseFloat(label.dataset.leftX || '0');
      const topY = parseFloat(label.dataset.topY || '0');
      const screenX = (leftX + pan.x) * zoom;
      const screenY = (topY + pan.y) * zoom + LABEL_OFFSET_Y;
      label.style.left = screenX + 'px';
      label.style.top = screenY + 'px';
    }
  }
}
