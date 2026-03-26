// Book watermarks - large faint book names visible when zoomed out

import type { VerseLayout } from './types.ts';
import { BOOK_HEBREW_NAMES } from './constants/books.ts';
import { stripNikkud } from './search.ts';

interface BookBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface Pan {
  x: number;
  y: number;
}

// Zoom thresholds for watermark visibility
const FADE_START = 1.5;  // start fading in below this zoom
const FADE_END = 0.5;    // fully visible at this zoom
const MAX_OPACITY = 0.15; // subtle white text

/**
 * Compute the opacity for watermarks based on current zoom level.
 * Fades in as zoom decreases: invisible at zoom >= 1.5, max opacity at zoom <= 0.5.
 */
function watermarkOpacity(zoom: number): number {
  if (zoom >= FADE_START) return 0;
  if (zoom <= FADE_END) return MAX_OPACITY;
  // Linear interpolation between FADE_END and FADE_START
  return MAX_OPACITY * (FADE_START - zoom) / (FADE_START - FADE_END);
}

/**
 * Create watermark HTML elements for all books.
 * Inserts a container behind the WebGL canvas with pointer-events: none.
 */
export function createWatermarks(
  verses: VerseLayout[],
  container: HTMLElement,
): HTMLDivElement {
  // Group verses by book to find bounding boxes
  const books: Record<string, BookBounds> = {};
  for (const v of verses) {
    if (!books[v.book]) {
      books[v.book] = { minX: v.x, maxX: v.x + v.size, minY: v.y, maxY: v.y + v.size };
    }
    const b = books[v.book];
    b.minX = Math.min(b.minX, v.x);
    b.maxX = Math.max(b.maxX, v.x + v.size);
    b.minY = Math.min(b.minY, v.y);
    b.maxY = Math.max(b.maxY, v.y + v.size);
  }

  const watermarks = document.createElement('div');
  watermarks.id = 'book-watermarks';
  // z-index 1 places it above the canvas but below controls (z-index 10) and labels
  watermarks.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;overflow:hidden;width:100vw;height:100vh;z-index:1;';

  for (const [name, bounds] of Object.entries(books)) {
    const el = document.createElement('div');
    const bookWidth = bounds.maxX - bounds.minX;
    const bookHeight = bounds.maxY - bounds.minY;
    // Center of the book's bounding box in world coordinates
    const centerX = bounds.minX + bookWidth / 2;
    const centerY = bounds.minY + bookHeight / 2;

    el.style.cssText = `
      position:absolute;
      color:rgba(255,255,255,1);
      font-weight:700;
      white-space:nowrap;
      font-family:"Noto Sans Hebrew", system-ui, sans-serif;
      text-align:center;
      transform-origin:center center;
      user-select:none;
    `;
    el.dataset.centerX = String(centerX);
    el.dataset.centerY = String(centerY);
    el.dataset.bookWidth = String(bookWidth);
    el.dataset.bookHeight = String(bookHeight);

    const heName = BOOK_HEBREW_NAMES[name];
    el.textContent = heName ? stripNikkud(heName) : name;

    watermarks.appendChild(el);
  }

  // Append to container; z-index places it above canvas but below UI controls
  container.appendChild(watermarks);

  return watermarks;
}

/**
 * Update watermark positions based on camera pan/zoom.
 * Handles opacity fading and world-to-screen coordinate transforms.
 */
export function updateWatermarkPositions(
  watermarksContainer: HTMLElement,
  pan: Pan,
  zoom: number,
): void {
  const opacity = watermarkOpacity(zoom);

  // Hide container entirely when invisible for performance
  if (opacity <= 0) {
    watermarksContainer.style.display = 'none';
    return;
  }
  watermarksContainer.style.display = '';

  for (const el of watermarksContainer.children) {
    if (!(el instanceof HTMLElement)) continue;

    const centerX = parseFloat(el.dataset.centerX || '0');
    const centerY = parseFloat(el.dataset.centerY || '0');
    const bookWidth = parseFloat(el.dataset.bookWidth || '0');
    const bookHeight = parseFloat(el.dataset.bookHeight || '0');

    // World-to-screen transform (same as labels.ts)
    const screenCenterX = (centerX + pan.x) * zoom;
    const screenCenterY = (centerY + pan.y) * zoom;

    // Font size proportional to the book's area on screen, but capped
    // Use the smaller dimension to ensure text fits within the book bounds
    const screenWidth = bookWidth * zoom;
    const screenHeight = bookHeight * zoom;
    // Use the smaller of width and height to constrain, aiming for text
    // that fills roughly 60% of the narrower dimension
    const constrainingDim = Math.min(screenWidth, screenHeight);
    const fontSize = Math.max(8, Math.min(200, constrainingDim * 0.5));

    el.style.left = screenCenterX + 'px';
    el.style.top = screenCenterY + 'px';
    el.style.fontSize = fontSize + 'px';
    el.style.opacity = String(opacity);
    el.style.transform = 'translate(-50%, -50%)';
  }
}
