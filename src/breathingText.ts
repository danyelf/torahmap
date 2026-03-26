// Breathing Text - reverent proximity-reveal effect
// When hovering over a verse, neighboring verses subtly reveal their opening Hebrew words.
// Text fades in/out based on distance, like words barely visible beneath the surface.

import type { VerseLayout } from './types.ts';
import type { Camera } from './camera.ts';
import type { VerseTexts } from './verseTexts.ts';
import { getVerseText } from './verseTexts.ts';

// Configuration
const RADIUS_IN_VERSES = 7;        // Radius in verse-size units
const MAX_OPACITY = 0.55;          // Opacity at the hovered verse
const MIN_OPACITY = 0.08;          // Opacity at the edge of the radius
const TRANSITION_MS = 300;         // CSS transition duration
const MIN_ZOOM = 1.5;              // Only show when zoomed in enough
const POOL_SIZE = 80;              // Max DOM elements in pool
const OPENING_WORDS = 3;           // Number of Hebrew words to show
const BASE_FONT_SIZE = 4.5;        // Font size at zoom=1 (in px, scales with zoom)
const MIN_FONT_SIZE = 6;           // Minimum font size
const MAX_FONT_SIZE = 28;          // Maximum font size

interface BreathingTextState {
  container: HTMLDivElement;
  pool: HTMLDivElement[];
  activeCount: number;
  currentHoveredVerse: VerseLayout | null;
}

/** Extract the first N Hebrew words from verse text */
function getOpeningWords(text: string, count: number): string {
  // Split on whitespace, take first N words
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
  const pool: HTMLDivElement[] = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const el = document.createElement('div');
    el.style.cssText = `
      position:absolute;
      color:rgba(255,255,255,1);
      font-family:"Noto Sans Hebrew", system-ui, sans-serif;
      white-space:nowrap;
      pointer-events:none;
      opacity:0;
      transition:opacity ${TRANSITION_MS}ms ease-out;
      text-shadow:0 0 4px rgba(0,0,0,0.7), 0 0 8px rgba(0,0,0,0.4);
      transform:translate(-50%, -50%);
      direction:rtl;
    `;
    overlayDiv.appendChild(el);
    pool.push(el);
  }

  return {
    container: overlayDiv,
    pool,
    activeCount: 0,
    currentHoveredVerse: null,
  };
}

/** Find verses within a radius of the target verse (in world units) */
function findNeighbors(
  verses: VerseLayout[],
  target: VerseLayout,
  radiusWorld: number
): Array<{ verse: VerseLayout; dist: number }> {
  const cx = target.x + target.size / 2;
  const cy = target.y + target.size / 2;
  const results: Array<{ verse: VerseLayout; dist: number }> = [];

  for (const v of verses) {
    const vx = v.x + v.size / 2;
    const vy = v.y + v.size / 2;
    const dx = vx - cx;
    const dy = vy - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= radiusWorld) {
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
    // Just reposition existing elements
    repositionBreathingText(state, camera);
    return;
  }

  state.currentHoveredVerse = hoveredVerse;

  // Calculate world-space radius
  const radiusWorld = RADIUS_IN_VERSES * hoveredVerse.size;

  // Find neighbors
  const neighbors = findNeighbors(verses, hoveredVerse, radiusWorld);

  // Sort by distance (closest first) and limit to pool size
  neighbors.sort((a, b) => a.dist - b.dist);
  const visible = neighbors.slice(0, POOL_SIZE);

  const fontSize = Math.max(
    MIN_FONT_SIZE,
    Math.min(MAX_FONT_SIZE, BASE_FONT_SIZE * camera.zoom)
  );

  // Assign pool elements
  let activeIdx = 0;
  for (const { verse, dist } of visible) {
    const vt = getVerseText(verseTexts, verse.book, verse.chapter, verse.verse);
    if (!vt || !vt.he) continue;

    const openingText = getOpeningWords(vt.he, OPENING_WORDS);
    if (!openingText) continue;

    if (activeIdx >= POOL_SIZE) break;

    const el = state.pool[activeIdx];
    const screenPos = worldToScreen(
      verse.x + verse.size / 2,
      verse.y + verse.size / 2,
      camera
    );

    const opacity = opacityForDistance(dist, radiusWorld);

    el.textContent = openingText;
    el.style.left = screenPos.x + 'px';
    el.style.top = screenPos.y + 'px';
    el.style.fontSize = fontSize + 'px';
    el.style.opacity = String(opacity);

    // Store world coordinates for repositioning during pan/zoom
    el.dataset.worldX = String(verse.x + verse.size / 2);
    el.dataset.worldY = String(verse.y + verse.size / 2);
    el.dataset.targetOpacity = String(opacity);

    activeIdx++;
  }

  // Hide unused pool elements
  for (let i = activeIdx; i < state.activeCount; i++) {
    state.pool[i].style.opacity = '0';
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
    const el = state.pool[i];
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
    state.pool[i].style.opacity = '0';
  }

  state.activeCount = 0;
  state.currentHoveredVerse = null;
}
