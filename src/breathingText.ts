// Breathing Text - reverent proximity-reveal effect
// When hovering over a verse, nearby verses in the SAME ROW (chapter) subtly reveal
// their opening Hebrew word. Text fades in with a staggered upward drift animation,
// showing only every Nth verse for a sparse, scroll-like feel.

import type { VerseLayout } from './types.ts';
import type { Camera } from './camera.ts';
import type { VerseTexts } from './verseTexts.ts';
import { getVerseText } from './verseTexts.ts';

// Configuration
const RADIUS_IN_VERSES = 10;       // Radius in verse-size units (along the row)
const MAX_OPACITY = 0.3;           // Ghostly max opacity at the hovered verse
const MIN_OPACITY = 0.05;          // Opacity at the edge of the radius
const FADE_IN_MS = 400;            // CSS transition duration for fade in
const FADE_OUT_MS = 250;           // CSS transition duration for fade out
const MIN_ZOOM = 1.5;              // Only show when zoomed in enough
const POOL_SIZE = 40;              // Max DOM elements in pool
const OPENING_WORDS = 1;           // Show only the FIRST word of each verse
const BASE_FONT_SIZE = 6;          // Larger font for readability at zoom=1
const MIN_FONT_SIZE = 8;           // Minimum font size
const MAX_FONT_SIZE = 32;          // Maximum font size
const VERSE_SKIP = 3;              // Show every Nth verse (reduces density)
const STAGGER_DELAY_MS = 80;       // Delay per unit of distance for staggered reveal
const DRIFT_PX = 8;                // Upward drift distance for animation

interface BreathingTextElement {
  el: HTMLDivElement;
  revealTimer: ReturnType<typeof setTimeout> | null;
}

interface BreathingTextState {
  container: HTMLDivElement;
  pool: BreathingTextElement[];
  activeCount: number;
  currentHoveredVerse: VerseLayout | null;
}

/** Extract the first N Hebrew words from verse text */
function getOpeningWords(text: string, count: number): string {
  const words = text.trim().split(/\s+/);
  return words.slice(0, count).join(' ');
}

/** Convert world coordinates to screen coordinates */
function worldToScreen(
  worldX: number,
  worldY: number,
  camera: Camera
): { x: number; y: number } {
  return {
    x: (worldX + camera.x) * camera.zoom,
    y: (worldY + camera.y) * camera.zoom,
  };
}

/** Calculate opacity based on distance (linear falloff) */
function opacityForDistance(dist: number, maxDist: number): number {
  if (dist >= maxDist) return 0;
  const t = 1 - dist / maxDist;
  return MIN_OPACITY + (MAX_OPACITY - MIN_OPACITY) * t;
}

/** Create the breathing text overlay system */
export function createBreathingText(container: HTMLElement): BreathingTextState {
  const overlayDiv = document.createElement('div');
  overlayDiv.id = 'breathing-text';
  overlayDiv.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:5;';
  container.appendChild(overlayDiv);

  // Pre-allocate pool of DOM elements
  const pool: BreathingTextElement[] = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const el = document.createElement('div');
    el.style.cssText = `
      position:absolute;
      color:rgba(255,255,255,1);
      font-family:"Noto Sans Hebrew", system-ui, sans-serif;
      white-space:nowrap;
      pointer-events:none;
      opacity:0;
      transition:opacity ${FADE_OUT_MS}ms ease-out, transform ${FADE_IN_MS}ms ease-out;
      text-shadow:0 0 6px rgba(0,0,0,0.8), 0 0 12px rgba(0,0,0,0.4);
      transform:translate(-50%, -100%) translateY(${DRIFT_PX}px);
      direction:rtl;
      will-change:opacity,transform;
    `;
    overlayDiv.appendChild(el);
    pool.push({ el, revealTimer: null });
  }

  return {
    container: overlayDiv,
    pool,
    activeCount: 0,
    currentHoveredVerse: null,
  };
}

/** Find verses in the same chapter (row) within a horizontal radius */
function findRowNeighbors(
  verses: VerseLayout[],
  target: VerseLayout,
  radiusWorld: number
): Array<{ verse: VerseLayout; dist: number }> {
  const cx = target.x + target.size / 2;
  const results: Array<{ verse: VerseLayout; dist: number }> = [];

  for (const v of verses) {
    // Only same book and chapter (same row)
    if (v.book !== target.book || v.chapter !== target.chapter) continue;

    const vx = v.x + v.size / 2;
    const dist = Math.abs(vx - cx);

    if (dist <= radiusWorld && dist > 0) {
      results.push({ verse: v, dist });
    }
  }

  return results;
}

/** Update the breathing text overlay based on current hover state */
export function updateBreathingText(
  state: BreathingTextState,
  hoveredVerse: VerseLayout | null,
  verses: VerseLayout[],
  verseTexts: VerseTexts,
  camera: Camera,
  isDragging: boolean
): void {
  // Hide all if conditions aren't met
  if (!hoveredVerse || camera.zoom < MIN_ZOOM || isDragging) {
    clearBreathingText(state);
    return;
  }

  // Skip update if same verse is still hovered (positions handled by repositionBreathingText)
  if (state.currentHoveredVerse &&
      state.currentHoveredVerse.book === hoveredVerse.book &&
      state.currentHoveredVerse.chapter === hoveredVerse.chapter &&
      state.currentHoveredVerse.verse === hoveredVerse.verse) {
    repositionBreathingText(state, camera);
    return;
  }

  // Clear pending timers from previous hover
  for (const item of state.pool) {
    if (item.revealTimer !== null) {
      clearTimeout(item.revealTimer);
      item.revealTimer = null;
    }
  }

  state.currentHoveredVerse = hoveredVerse;

  // Calculate world-space radius
  const radiusWorld = RADIUS_IN_VERSES * hoveredVerse.size;

  // Find neighbors along the same row (chapter)
  const neighbors = findRowNeighbors(verses, hoveredVerse, radiusWorld);

  // Sort by distance (closest first)
  neighbors.sort((a, b) => a.dist - b.dist);

  // Sparse sampling: keep every Nth verse
  const sparse = neighbors.filter((_, i) => i % VERSE_SKIP === 0);
  const visible = sparse.slice(0, POOL_SIZE);

  const fontSize = Math.max(
    MIN_FONT_SIZE,
    Math.min(MAX_FONT_SIZE, BASE_FONT_SIZE * camera.zoom)
  );

  // First, hide all currently active elements immediately (set short fade-out)
  for (let i = 0; i < state.activeCount; i++) {
    const item = state.pool[i];
    item.el.style.transition = `opacity ${FADE_OUT_MS}ms ease-out, transform ${FADE_OUT_MS}ms ease-out`;
    item.el.style.opacity = '0';
    item.el.style.transform = `translate(-50%, -100%) translateY(${DRIFT_PX}px)`;
  }

  // Assign pool elements with staggered reveal
  let activeIdx = 0;
  for (const { verse, dist } of visible) {
    const vt = getVerseText(verseTexts, verse.book, verse.chapter, verse.verse);
    if (!vt || !vt.he) continue;

    const openingText = getOpeningWords(vt.he, OPENING_WORDS);
    if (!openingText) continue;

    if (activeIdx >= POOL_SIZE) break;

    const item = state.pool[activeIdx];
    const el = item.el;

    // Position text ABOVE the verse square (offset upward by verse height)
    const screenPos = worldToScreen(
      verse.x + verse.size / 2,
      verse.y,  // top of the verse square
      camera
    );

    const opacity = opacityForDistance(dist, radiusWorld);

    el.textContent = openingText;
    el.style.left = screenPos.x + 'px';
    el.style.top = screenPos.y + 'px';
    el.style.fontSize = fontSize + 'px';

    // Start hidden and drifted up
    el.style.transition = 'none';
    el.style.opacity = '0';
    el.style.transform = `translate(-50%, -100%) translateY(${DRIFT_PX}px)`;

    // Store world coordinates for repositioning during pan/zoom
    el.dataset.worldX = String(verse.x + verse.size / 2);
    el.dataset.worldY = String(verse.y);
    el.dataset.targetOpacity = String(opacity);

    // Staggered reveal: delay based on distance
    const delay = Math.round((dist / hoveredVerse.size) * STAGGER_DELAY_MS);

    item.revealTimer = setTimeout(() => {
      el.style.transition = `opacity ${FADE_IN_MS}ms ease-out, transform ${FADE_IN_MS}ms ease-out`;
      el.style.opacity = String(opacity);
      el.style.transform = 'translate(-50%, -100%) translateY(0px)';
      item.revealTimer = null;
    }, delay);

    activeIdx++;
  }

  // Hide unused pool elements
  for (let i = activeIdx; i < state.activeCount; i++) {
    state.pool[i].el.style.opacity = '0';
  }

  state.activeCount = activeIdx;
}

/** Reposition existing breathing text elements after pan/zoom changes */
export function repositionBreathingText(
  state: BreathingTextState,
  camera: Camera
): void {
  if (camera.zoom < MIN_ZOOM) {
    clearBreathingText(state);
    return;
  }

  const fontSize = Math.max(
    MIN_FONT_SIZE,
    Math.min(MAX_FONT_SIZE, BASE_FONT_SIZE * camera.zoom)
  );

  for (let i = 0; i < state.activeCount; i++) {
    const el = state.pool[i].el;
    const worldX = parseFloat(el.dataset.worldX || '0');
    const worldY = parseFloat(el.dataset.worldY || '0');
    const screenPos = worldToScreen(worldX, worldY, camera);

    el.style.left = screenPos.x + 'px';
    el.style.top = screenPos.y + 'px';
    el.style.fontSize = fontSize + 'px';
  }
}

/** Clear all breathing text (fade out via CSS transition) */
export function clearBreathingText(state: BreathingTextState): void {
  if (state.activeCount === 0 && state.currentHoveredVerse === null) return;

  for (let i = 0; i < state.activeCount; i++) {
    const item = state.pool[i];
    if (item.revealTimer !== null) {
      clearTimeout(item.revealTimer);
      item.revealTimer = null;
    }
    item.el.style.transition = `opacity ${FADE_OUT_MS}ms ease-out, transform ${FADE_OUT_MS}ms ease-out`;
    item.el.style.opacity = '0';
    item.el.style.transform = `translate(-50%, -100%) translateY(${DRIFT_PX}px)`;
  }

  state.activeCount = 0;
  state.currentHoveredVerse = null;
}
