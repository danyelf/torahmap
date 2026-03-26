// Gematria Constellations - draw constellation-like lines between verses with matching numerical values
//
// Each Hebrew letter has a numerical value (gematria). When hovering a verse,
// we find nearby verses with matching or close gematria values and draw subtle
// connecting lines like star constellations.

import type { VerseLayout } from './types.ts';
import type { VerseTexts } from './verseTexts.ts';
import type { Camera } from './camera.ts';
import { stripNikkud } from './search.ts';
import { getVerseText } from './verseTexts.ts';

// Gematria letter values
const GEMATRIA_VALUES: Record<string, number> = {
  'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
  'י': 10, 'כ': 20, 'ך': 20, 'ל': 30, 'מ': 40, 'ם': 40, 'נ': 50, 'ן': 50,
  'ס': 60, 'ע': 70, 'פ': 80, 'ף': 80, 'צ': 90, 'ץ': 90, 'ק': 100, 'ר': 200,
  'ש': 300, 'ת': 400,
};

// Configuration
const SEARCH_RADIUS = 50;       // verses in each direction to scan
const MAX_CONNECTIONS = 18;     // max lines to draw
const CLOSE_MATCH_PERCENT = 0.05; // ±5% for "close" matches
const EXACT_OPACITY = 0.25;     // opacity for exact matches
const CLOSE_OPACITY = 0.12;     // opacity for close matches
const DOT_RADIUS = 2.5;         // radius of dots at matching verses
const FADE_DURATION_MS = 200;   // fade in/out duration
const LINE_COLOR = '180, 200, 255'; // pale blue RGB

export interface GematriaState {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  gematriaValues: Float64Array;  // gematria value per verse index
  currentHoverIndex: number;     // index of currently hovered verse, or -1
  fadeAlpha: number;             // current fade alpha (0 to 1)
  fadeTarget: number;            // target fade alpha
  animationFrame: number | null;
  connections: GematriaConnection[];
  hoveredGematria: number;       // gematria value of hovered verse
}

interface GematriaConnection {
  fromIndex: number;
  toIndex: number;
  isExact: boolean;
}

/**
 * Compute gematria value for a Hebrew text string.
 * Strips nikkud first, then sums letter values.
 */
export function computeGematria(hebrewText: string): number {
  const stripped = stripNikkud(hebrewText);
  let total = 0;
  for (const char of stripped) {
    const value = GEMATRIA_VALUES[char];
    if (value !== undefined) {
      total += value;
    }
  }
  return total;
}

/**
 * Precompute gematria values for all verses.
 */
function buildGematriaIndex(verses: VerseLayout[], verseTexts: VerseTexts): Float64Array {
  const values = new Float64Array(verses.length);
  for (let i = 0; i < verses.length; i++) {
    const v = verses[i];
    const text = getVerseText(verseTexts, v.book, v.chapter, v.verse);
    if (text) {
      values[i] = computeGematria(text.he);
    }
  }
  return values;
}

/**
 * Find connections from the hovered verse to nearby verses with matching gematria.
 */
function findConnections(
  hoverIndex: number,
  gematriaValues: Float64Array,
  totalVerses: number
): GematriaConnection[] {
  const hoverValue = gematriaValues[hoverIndex];
  if (hoverValue === 0) return [];

  const threshold = hoverValue * CLOSE_MATCH_PERCENT;
  const connections: GematriaConnection[] = [];

  const startIdx = Math.max(0, hoverIndex - SEARCH_RADIUS);
  const endIdx = Math.min(totalVerses - 1, hoverIndex + SEARCH_RADIUS);

  // Collect all candidates with their distance from hover
  const candidates: Array<{ index: number; isExact: boolean; distance: number }> = [];

  for (let i = startIdx; i <= endIdx; i++) {
    if (i === hoverIndex) continue;
    const diff = Math.abs(gematriaValues[i] - hoverValue);
    if (diff === 0) {
      candidates.push({ index: i, isExact: true, distance: Math.abs(i - hoverIndex) });
    } else if (diff <= threshold) {
      candidates.push({ index: i, isExact: false, distance: Math.abs(i - hoverIndex) });
    }
  }

  // Sort: exact matches first, then by distance
  candidates.sort((a, b) => {
    if (a.isExact !== b.isExact) return a.isExact ? -1 : 1;
    return a.distance - b.distance;
  });

  // Take top N
  const limit = Math.min(candidates.length, MAX_CONNECTIONS);
  for (let i = 0; i < limit; i++) {
    connections.push({
      fromIndex: hoverIndex,
      toIndex: candidates[i].index,
      isExact: candidates[i].isExact,
    });
  }

  return connections;
}

/**
 * Convert world coordinates to screen coordinates.
 */
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

/**
 * Draw the constellation overlay.
 */
function drawConstellations(
  state: GematriaState,
  verses: VerseLayout[],
  camera: Camera
): void {
  const { ctx, canvas, connections, fadeAlpha, currentHoverIndex, hoveredGematria } = state;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (fadeAlpha <= 0.01 || connections.length === 0 || currentHoverIndex < 0) return;

  const dpr = window.devicePixelRatio || 1;

  // Draw lines
  for (const conn of connections) {
    const from = verses[conn.fromIndex];
    const to = verses[conn.toIndex];

    const fromScreen = worldToScreen(from.x + from.size / 2, from.y + from.size / 2, camera);
    const toScreen = worldToScreen(to.x + to.size / 2, to.y + to.size / 2, camera);

    const baseOpacity = conn.isExact ? EXACT_OPACITY : CLOSE_OPACITY;
    const opacity = baseOpacity * fadeAlpha;

    ctx.beginPath();
    ctx.moveTo(fromScreen.x * dpr, fromScreen.y * dpr);
    ctx.lineTo(toScreen.x * dpr, toScreen.y * dpr);
    ctx.strokeStyle = `rgba(${LINE_COLOR}, ${opacity})`;
    ctx.lineWidth = (conn.isExact ? 1.5 : 1) * dpr;
    ctx.stroke();
  }

  // Draw dots at matching verse positions
  const drawnDots = new Set<number>();
  drawnDots.add(currentHoverIndex);

  for (const conn of connections) {
    if (drawnDots.has(conn.toIndex)) continue;
    drawnDots.add(conn.toIndex);

    const to = verses[conn.toIndex];
    const toScreen = worldToScreen(to.x + to.size / 2, to.y + to.size / 2, camera);
    const dotOpacity = (conn.isExact ? EXACT_OPACITY * 1.5 : CLOSE_OPACITY * 1.5) * fadeAlpha;

    ctx.beginPath();
    ctx.arc(toScreen.x * dpr, toScreen.y * dpr, DOT_RADIUS * dpr, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${LINE_COLOR}, ${dotOpacity})`;
    ctx.fill();
  }

  // Draw a brighter dot at the hovered verse
  const hoverVerse = verses[currentHoverIndex];
  const hoverScreen = worldToScreen(
    hoverVerse.x + hoverVerse.size / 2,
    hoverVerse.y + hoverVerse.size / 2,
    camera
  );
  ctx.beginPath();
  ctx.arc(hoverScreen.x * dpr, hoverScreen.y * dpr, (DOT_RADIUS + 1) * dpr, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${LINE_COLOR}, ${0.5 * fadeAlpha})`;
  ctx.fill();

  // Draw gematria value label near hovered verse
  if (hoveredGematria > 0) {
    const labelX = hoverScreen.x * dpr + 8 * dpr;
    const labelY = hoverScreen.y * dpr - 8 * dpr;
    const fontSize = 11 * dpr;

    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = `rgba(${LINE_COLOR}, ${0.7 * fadeAlpha})`;
    ctx.fillText(`=${hoveredGematria}`, labelX, labelY);
  }
}

/**
 * Animation loop for fade in/out.
 */
function animate(
  state: GematriaState,
  verses: VerseLayout[],
  camera: Camera
): void {
  const step = 1 / (FADE_DURATION_MS / 16); // ~60fps step size

  if (state.fadeTarget > state.fadeAlpha) {
    state.fadeAlpha = Math.min(state.fadeAlpha + step, state.fadeTarget);
  } else if (state.fadeTarget < state.fadeAlpha) {
    state.fadeAlpha = Math.max(state.fadeAlpha - step, state.fadeTarget);
  }

  drawConstellations(state, verses, camera);

  // Continue animation if not at target
  if (Math.abs(state.fadeAlpha - state.fadeTarget) > 0.01) {
    state.animationFrame = requestAnimationFrame(() => animate(state, verses, camera));
  } else {
    state.fadeAlpha = state.fadeTarget;
    state.animationFrame = null;

    // Final draw at target alpha
    drawConstellations(state, verses, camera);
  }
}

/**
 * Initialize the gematria constellations system.
 * Creates a canvas overlay and precomputes gematria values.
 */
export function initGematriaConstellations(
  verses: VerseLayout[],
  verseTexts: VerseTexts
): GematriaState {
  // Create canvas overlay
  const canvas = document.createElement('canvas');
  canvas.id = 'gematria-canvas';
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '5';

  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;

  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;

  // Handle window resize
  window.addEventListener('resize', () => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
  });

  const gematriaValues = buildGematriaIndex(verses, verseTexts);

  return {
    canvas,
    ctx,
    gematriaValues,
    currentHoverIndex: -1,
    fadeAlpha: 0,
    fadeTarget: 0,
    animationFrame: null,
    connections: [],
    hoveredGematria: 0,
  };
}

/**
 * Update the constellation display when hover changes.
 * Call this from the hover handler in main.ts.
 */
export function updateGematriaHover(
  state: GematriaState,
  verses: VerseLayout[],
  camera: Camera,
  hoveredVerse: VerseLayout | null
): void {
  if (hoveredVerse) {
    // Find the verse index
    const idx = verses.indexOf(hoveredVerse);
    if (idx < 0) {
      // Fallback: search by identity
      const found = verses.findIndex(
        v => v.book === hoveredVerse.book &&
             v.chapter === hoveredVerse.chapter &&
             v.verse === hoveredVerse.verse
      );
      if (found < 0) return;
      state.currentHoverIndex = found;
    } else {
      state.currentHoverIndex = idx;
    }

    state.hoveredGematria = state.gematriaValues[state.currentHoverIndex];
    state.connections = findConnections(
      state.currentHoverIndex,
      state.gematriaValues,
      verses.length
    );
    state.fadeTarget = 1;
  } else {
    state.fadeTarget = 0;
  }

  // Start or continue animation
  if (state.animationFrame === null) {
    state.animationFrame = requestAnimationFrame(() => animate(state, verses, camera));
  }
}

/**
 * Redraw constellations without changing hover state.
 * Call this after camera changes (pan/zoom).
 */
export function redrawGematriaConstellations(
  state: GematriaState,
  verses: VerseLayout[],
  camera: Camera
): void {
  drawConstellations(state, verses, camera);
}
