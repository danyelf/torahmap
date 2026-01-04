// Render book labels as HTML overlays

import type { Verse } from './types.ts';

interface BookBounds {
  minX: number;
  maxX: number;
}

interface Pan {
  x: number;
  y: number;
}

export function createBookLabels(verses: Verse[], container: HTMLElement): HTMLDivElement {
  // Group verses by book to find column positions
  const books: Record<string, BookBounds> = {};
  for (const v of verses) {
    if (!books[v.book]) {
      books[v.book] = { minX: v.x, maxX: v.x + v.size };
    }
    books[v.book].maxX = Math.max(books[v.book].maxX, v.x + v.size);
  }

  const labels = document.createElement('div');
  labels.id = 'book-labels';
  labels.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;';

  for (const [name, pos] of Object.entries(books)) {
    const label = document.createElement('div');
    label.textContent = name;
    label.style.cssText = `
      position:absolute;
      color:#666;
      font-family:sans-serif;
      font-size:12px;
      transform:translateX(-50%);
    `;
    label.dataset.bookName = name;
    label.dataset.centerX = String((pos.minX + pos.maxX) / 2);
    labels.appendChild(label);
  }

  container.appendChild(labels);
  return labels;
}

export function updateLabelPositions(labelsContainer: HTMLElement, pan: Pan, zoom: number): void {
  for (const label of labelsContainer.children) {
    if (label instanceof HTMLElement) {
      const centerX = parseFloat(label.dataset.centerX || '0');
      const screenX = (centerX + pan.x) * zoom;
      label.style.left = screenX + 'px';
      label.style.top = '30px';
    }
  }
}
