// Thread Lines - visual connections between verses that share rare Hebrew words
// Draws curved lines on a Canvas 2D overlay when hovering a verse

import type { VerseLayout } from './types.ts';
import type { VerseTexts } from './verseTexts.ts';
import type { Camera } from './camera.ts';
import { stripNikkud } from './search.ts';
import { getVerseKey } from './types.ts';

// --- Configuration ---
const MAX_CONNECTIONS = 7;
const MAX_WORD_FREQUENCY = 200;
const MIN_WORD_LENGTH = 2;
const FADE_IN_MS = 200;
const FADE_OUT_MS = 300;
const LINE_COLOR = [218, 165, 32]; // golden
const LINE_BASE_OPACITY = 0.35;
const LINE_WIDTH = 1.5;
const LABEL_FONT_SIZE = 10;
const HIGHLIGHT_RADIUS = 4;

// --- Word Index ---
// For each word, store which verses contain it
interface WordEntry {
  word: string;
  verseKeys: Set<string>;
}

let wordIndex: Map<string, WordEntry> | null = null;
// verse key -> list of words (nikkud-stripped) in that verse
let verseWords: Map<string, string[]> | null = null;

/**
 * Build the reverse word index from all verse texts.
 * Should be called once after texts are loaded.
 */
export function buildWordIndex(verseTexts: VerseTexts): void {
  wordIndex = new Map();
  verseWords = new Map();

  const wordFrequency = new Map<string, Set<string>>();

  for (const [book, chapters] of Object.entries(verseTexts)) {
    for (const [chapter, verses] of Object.entries(chapters)) {
      for (const [verse, text] of Object.entries(verses)) {
        const key = getVerseKey(book, Number(chapter), Number(verse));
        const hebrewText = text.he;
        if (!hebrewText) continue;

        // Strip nikkud and split into words
        const stripped = stripNikkud(hebrewText);
        // Split on non-Hebrew characters (spaces, punctuation, maqaf, etc.)
        const words = stripped.split(/[^\u05D0-\u05EA]+/).filter(w => w.length >= MIN_WORD_LENGTH);

        // Deduplicate words within this verse
        const uniqueWords = [...new Set(words)];
        verseWords.set(key, uniqueWords);

        for (const word of uniqueWords) {
          let freq = wordFrequency.get(word);
          if (!freq) {
            freq = new Set();
            wordFrequency.set(word, freq);
          }
          freq.add(key);
        }
      }
    }
  }

  // Filter out common words and build final index
  for (const [word, verses] of wordFrequency) {
    if (verses.size <= MAX_WORD_FREQUENCY && verses.size >= 2) {
      wordIndex.set(word, { word, verseKeys: verses });
    }
  }

  console.log(`Thread lines: indexed ${wordIndex.size} rare words from ${verseWords.size} verses`);
}

/**
 * Connection between two verses via a shared rare word.
 */
export interface ThreadConnection {
  targetVerse: VerseLayout;
  sharedWord: string;
  rarity: number; // lower = rarer = more interesting
}

/**
 * Find thread connections for a given verse.
 */
export function findConnections(
  verse: VerseLayout,
  allVerses: VerseLayout[]
): ThreadConnection[] {
  if (!wordIndex || !verseWords) return [];

  const key = getVerseKey(verse.book, verse.chapter, verse.verse);
  const words = verseWords.get(key);
  if (!words) return [];

  // For each word in this verse, find other verses sharing it
  // Rank by rarity (fewer occurrences = more interesting)
  const candidates: Array<{ targetKey: string; word: string; rarity: number }> = [];
  const seenTargets = new Set<string>();

  for (const word of words) {
    const entry = wordIndex.get(word);
    if (!entry) continue;

    for (const targetKey of entry.verseKeys) {
      if (targetKey === key) continue;
      // Take the rarest word connection for each target verse
      const compositeKey = `${targetKey}:${word}`;
      if (!seenTargets.has(compositeKey)) {
        seenTargets.add(compositeKey);
        candidates.push({ targetKey, word, rarity: entry.verseKeys.size });
      }
    }
  }

  // Sort by rarity (rarest first), then take top N
  candidates.sort((a, b) => a.rarity - b.rarity);

  // Deduplicate by target verse (keep rarest word per target)
  const bestPerTarget = new Map<string, { word: string; rarity: number }>();
  for (const c of candidates) {
    if (!bestPerTarget.has(c.targetKey)) {
      bestPerTarget.set(c.targetKey, { word: c.word, rarity: c.rarity });
    }
  }

  // Sort targets by rarity and take top MAX_CONNECTIONS
  const sortedTargets = [...bestPerTarget.entries()]
    .sort((a, b) => a[1].rarity - b[1].rarity)
    .slice(0, MAX_CONNECTIONS);

  // Build verse lookup for quick access
  const verseLookup = new Map<string, VerseLayout>();
  for (const v of allVerses) {
    verseLookup.set(getVerseKey(v.book, v.chapter, v.verse), v);
  }

  const connections: ThreadConnection[] = [];
  for (const [targetKey, { word, rarity }] of sortedTargets) {
    const targetVerse = verseLookup.get(targetKey);
    if (targetVerse) {
      connections.push({ targetVerse, sharedWord: word, rarity });
    }
  }

  return connections;
}

// --- Canvas Overlay Renderer ---

interface ThreadLinesState {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  currentVerse: VerseLayout | null;
  connections: ThreadConnection[];
  opacity: number;
  fadeStartTime: number;
  fadingIn: boolean;
  fadingOut: boolean;
  animationFrame: number | null;
  allVerses: VerseLayout[];
}

let state: ThreadLinesState | null = null;

/**
 * Initialize the thread lines canvas overlay.
 * Call once after the main canvas is set up.
 */
export function initThreadLines(
  parentElement: HTMLElement,
  allVerses: VerseLayout[]
): void {
  const canvas = document.createElement('canvas');
  canvas.id = 'thread-lines-canvas';
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '1';
  parentElement.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Thread lines: failed to get 2D context');
    return;
  }

  // Size to match window
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';

  state = {
    canvas,
    ctx,
    currentVerse: null,
    connections: [],
    opacity: 0,
    fadeStartTime: 0,
    fadingIn: false,
    fadingOut: false,
    animationFrame: null,
    allVerses,
  };

  // Handle resize
  window.addEventListener('resize', () => {
    if (!state) return;
    const dpr = window.devicePixelRatio || 1;
    state.canvas.width = window.innerWidth * dpr;
    state.canvas.height = window.innerHeight * dpr;
    state.canvas.style.width = window.innerWidth + 'px';
    state.canvas.style.height = window.innerHeight + 'px';
  });
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
 * Draw a quadratic bezier curve between two points with a control point
 * offset perpendicular to the midpoint.
 */
function drawBezierLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opacity: number,
  dpr: number
): { midX: number; midY: number } {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  // Perpendicular offset for the control point (creates the curve)
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const curvature = Math.min(dist * 0.2, 80); // Cap curvature for very distant connections

  // Perpendicular direction
  const nx = -dy / (dist || 1);
  const ny = dx / (dist || 1);

  const cpX = midX + nx * curvature;
  const cpY = midY + ny * curvature;

  ctx.beginPath();
  ctx.moveTo(x1 * dpr, y1 * dpr);
  ctx.quadraticCurveTo(cpX * dpr, cpY * dpr, x2 * dpr, y2 * dpr);

  const [r, g, b] = LINE_COLOR;
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
  ctx.lineWidth = LINE_WIDTH * dpr;
  ctx.stroke();

  // Return the actual bezier midpoint (at t=0.5) for label placement
  const bezierMidX = 0.25 * x1 + 0.5 * cpX + 0.25 * x2;
  const bezierMidY = 0.25 * y1 + 0.5 * cpY + 0.25 * y2;

  return { midX: bezierMidX, midY: bezierMidY };
}

/**
 * Draw a word label at a point.
 */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opacity: number,
  dpr: number
): void {
  const fontSize = LABEL_FONT_SIZE * dpr;
  ctx.font = `${fontSize}px "Noto Sans Hebrew", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Background pill
  const metrics = ctx.measureText(text);
  const padX = 4 * dpr;
  const padY = 2 * dpr;
  const pillW = metrics.width + padX * 2;
  const pillH = fontSize + padY * 2;

  ctx.fillStyle = `rgba(30, 30, 30, ${opacity * 0.85})`;
  const rx = x * dpr - pillW / 2;
  const ry = y * dpr - pillH / 2;
  ctx.beginPath();
  ctx.roundRect(rx, ry, pillW, pillH, 3 * dpr);
  ctx.fill();

  // Text
  const [r, g, b] = LINE_COLOR;
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
  ctx.fillText(text, x * dpr, y * dpr);
}

/**
 * Draw a highlight glow around a connected verse.
 */
function drawHighlight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  opacity: number,
  dpr: number
): void {
  const cx = (x + size / 2) * dpr;
  const cy = (y + size / 2) * dpr;
  const r = HIGHLIGHT_RADIUS * dpr;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  // Parse the highlight color and apply current opacity
  ctx.fillStyle = `rgba(218, 165, 32, ${0.3 * opacity})`;
  ctx.fill();
}

/**
 * Render all thread lines for the current state.
 */
export function renderThreadLines(camera: Camera): void {
  if (!state || state.opacity <= 0) {
    if (state) {
      state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
    }
    return;
  }

  const { ctx, canvas, currentVerse, connections, opacity } = state;
  const dpr = window.devicePixelRatio || 1;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!currentVerse || connections.length === 0) return;

  // Source position (center of hovered verse)
  const srcScreen = worldToScreen(
    currentVerse.x + currentVerse.size / 2,
    currentVerse.y + currentVerse.size / 2,
    camera
  );

  for (const conn of connections) {
    const tgtScreen = worldToScreen(
      conn.targetVerse.x + conn.targetVerse.size / 2,
      conn.targetVerse.y + conn.targetVerse.size / 2,
      camera
    );

    // Draw the curve
    const lineOpacity = opacity * LINE_BASE_OPACITY;
    const { midX, midY } = drawBezierLine(
      ctx,
      srcScreen.x, srcScreen.y,
      tgtScreen.x, tgtScreen.y,
      lineOpacity,
      dpr
    );

    // Draw word label at curve midpoint
    drawLabel(ctx, conn.sharedWord, midX, midY, opacity, dpr);

    // Draw highlight on the target verse
    const tgtTopLeft = worldToScreen(conn.targetVerse.x, conn.targetVerse.y, camera);
    const screenSize = conn.targetVerse.size * camera.zoom;
    drawHighlight(ctx, tgtTopLeft.x, tgtTopLeft.y, screenSize, opacity, dpr);
  }
}

/**
 * Animate fade in/out and re-render.
 */
function animate(camera: Camera): void {
  if (!state) return;

  const now = performance.now();
  const elapsed = now - state.fadeStartTime;

  if (state.fadingIn) {
    state.opacity = Math.min(1, elapsed / FADE_IN_MS);
    if (state.opacity >= 1) {
      state.fadingIn = false;
    }
  } else if (state.fadingOut) {
    state.opacity = Math.max(0, 1 - elapsed / FADE_OUT_MS);
    if (state.opacity <= 0) {
      state.fadingOut = false;
      state.connections = [];
      state.currentVerse = null;
    }
  }

  renderThreadLines(camera);

  if (state.fadingIn || state.fadingOut) {
    state.animationFrame = requestAnimationFrame(() => animate(camera));
  } else {
    state.animationFrame = null;
  }
}

/**
 * Called when hover changes. Pass null to fade out.
 */
export function setThreadLineHover(
  verse: VerseLayout | null,
  camera: Camera
): void {
  if (!state) return;

  // Cancel any ongoing animation
  if (state.animationFrame !== null) {
    cancelAnimationFrame(state.animationFrame);
    state.animationFrame = null;
  }

  if (verse === null) {
    // Fade out
    if (state.currentVerse !== null && state.opacity > 0) {
      state.fadingOut = true;
      state.fadingIn = false;
      state.fadeStartTime = performance.now() - (1 - state.opacity) * FADE_OUT_MS;
      state.animationFrame = requestAnimationFrame(() => animate(camera));
    }
    return;
  }

  // Check if we're hovering the same verse
  if (
    state.currentVerse &&
    state.currentVerse.book === verse.book &&
    state.currentVerse.chapter === verse.chapter &&
    state.currentVerse.verse === verse.verse
  ) {
    return; // Same verse, no change
  }

  // New verse - compute connections and fade in
  state.currentVerse = verse;
  state.connections = findConnections(verse, state.allVerses);
  state.fadingIn = true;
  state.fadingOut = false;
  state.fadeStartTime = performance.now();
  state.opacity = 0;
  state.animationFrame = requestAnimationFrame(() => animate(camera));
}

/**
 * Force a redraw (e.g., after camera pan/zoom).
 */
export function redrawThreadLines(camera: Camera): void {
  if (!state || state.opacity <= 0) return;
  renderThreadLines(camera);
}
