// Ripple Words - hover effect where a ripple propagates outward revealing Hebrew words

import type { Camera } from './camera';
import type { VerseLayout } from './types';
import type { VerseTexts } from './verseTexts';
import { getVerseText } from './verseTexts';

// CSS injected once
let styleInjected = false;

function injectStyles(): void {
  if (styleInjected) return;
  styleInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    .ripple-word {
      position: fixed;
      pointer-events: none;
      font-family: "Noto Sans Hebrew", "SBL Hebrew", serif;
      color: #f5f0e8;
      opacity: 0;
      z-index: 1000;
      will-change: opacity;
      direction: rtl;
      text-align: center;
      transition: opacity 150ms ease-in;
      line-height: 1;
      text-shadow: 0 0 2px rgba(245, 240, 232, 0.3);
    }
    .ripple-word.visible {
      opacity: 0.35;
      transition: opacity 150ms ease-in;
    }
    .ripple-word.fading {
      opacity: 0;
      transition: opacity 250ms ease-out;
    }
  `;
  document.head.appendChild(style);
}

// Container for word elements
let container: HTMLDivElement | null = null;

function getContainer(): HTMLDivElement {
  if (!container) {
    container = document.createElement('div');
    container.id = 'ripple-words-container';
    container.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:1000;';
    document.body.appendChild(container);
  }
  return container;
}

// Pool of reusable DOM elements
const POOL_SIZE = 120;
let pool: HTMLSpanElement[] = [];
let poolInitialized = false;

function initPool(): void {
  if (poolInitialized) return;
  poolInitialized = true;
  const cont = getContainer();
  for (let i = 0; i < POOL_SIZE; i++) {
    const span = document.createElement('span');
    span.className = 'ripple-word';
    cont.appendChild(span);
    pool.push(span);
  }
}

// Track current ripple generation to cancel stale ones
let currentRippleId = 0;
let activeTimers: number[] = [];
let lastVerseKey = '';

/**
 * Extract the first meaningful Hebrew word from verse text.
 * Skips common prefixes that are just single-letter conjunctions.
 */
function getFirstWord(hebrewText: string): string {
  // Split on spaces, filter to actual Hebrew words
  const words = hebrewText.split(/\s+/).filter(w => /[\u0590-\u05FF]/.test(w));
  if (words.length === 0) return '';
  // Strip cantillation marks (U+0591-U+05AF) and vowel points (U+05B0-U+05BD, U+05BF, U+05C1-U+05C2, U+05C4-U+05C5, U+05C7)
  // to get cleaner display
  return words[0].replace(/[\u0591-\u05AF\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g, '');
}

/**
 * Convert world coordinates to screen coordinates.
 */
function worldToScreen(
  worldX: number,
  worldY: number,
  camera: Camera,
): { x: number; y: number } {
  return {
    x: (worldX + camera.x) * camera.zoom,
    y: (worldY + camera.y) * camera.zoom,
  };
}

/**
 * Calculate Euclidean distance between two verse positions in world space.
 */
function verseDistance(a: VerseLayout, b: VerseLayout): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Trigger a ripple effect from the hovered verse, revealing Hebrew words
 * on nearby verses in a concentric wave pattern.
 */
export function triggerRipple(
  verse: VerseLayout,
  allVerses: VerseLayout[],
  verseTexts: VerseTexts,
  camera: Camera,
): void {
  const verseKey = `${verse.book}:${verse.chapter}:${verse.verse}`;
  if (verseKey === lastVerseKey) return;
  lastVerseKey = verseKey;

  // Cancel any in-progress ripple
  cancelRipple();

  injectStyles();
  initPool();

  const rippleId = ++currentRippleId;

  // Ripple parameters
  const MAX_DISTANCE = verse.size * 15; // ~15 verses out in world units
  const DELAY_PER_UNIT = 50 / verse.size; // 50ms per verse-width of distance
  const VISIBLE_DURATION = 400; // ms each word stays visible

  // Gather nearby verses with their distances
  const nearby: Array<{ verse: VerseLayout; dist: number }> = [];
  for (const v of allVerses) {
    if (v === verse) continue;
    const dist = verseDistance(verse, v);
    if (dist <= MAX_DISTANCE) {
      nearby.push({ verse: v, dist });
    }
  }

  // Sort by distance for concentric reveal
  nearby.sort((a, b) => a.dist - b.dist);

  // Limit to pool size
  const toReveal = nearby.slice(0, POOL_SIZE);

  const verseScreenSize = verse.size * camera.zoom;
  const fontSize = Math.max(7, Math.min(18, verseScreenSize * 0.9));

  for (let i = 0; i < toReveal.length; i++) {
    const { verse: v, dist } = toReveal[i];

    // Get Hebrew text for this verse
    const vt = getVerseText(verseTexts, v.book, v.chapter, v.verse);
    if (!vt?.he) continue;

    const word = getFirstWord(vt.he);
    if (!word) continue;

    const span = pool[i];
    const delay = dist * DELAY_PER_UNIT;

    // Position the word centered on the verse square
    const centerX = v.x + v.size / 2;
    const centerY = v.y + v.size / 2;
    const screen = worldToScreen(centerX, centerY, camera);

    span.textContent = word;
    span.style.left = `${screen.x}px`;
    span.style.top = `${screen.y}px`;
    span.style.fontSize = `${fontSize}px`;
    span.style.transform = 'translate(-50%, -50%)';
    span.className = 'ripple-word';

    // Schedule fade-in
    const showTimer = window.setTimeout(() => {
      if (currentRippleId !== rippleId) return;
      span.className = 'ripple-word visible';
    }, delay);

    // Schedule fade-out
    const hideTimer = window.setTimeout(() => {
      if (currentRippleId !== rippleId) return;
      span.className = 'ripple-word fading';
    }, delay + VISIBLE_DURATION);

    // Schedule reset
    const resetTimer = window.setTimeout(() => {
      span.className = 'ripple-word';
      span.textContent = '';
    }, delay + VISIBLE_DURATION + 300);

    activeTimers.push(showTimer, hideTimer, resetTimer);
  }
}

/**
 * Cancel any in-progress ripple and reset all pool elements.
 */
export function cancelRipple(): void {
  currentRippleId++;
  for (const timer of activeTimers) {
    clearTimeout(timer);
  }
  activeTimers = [];
  for (const span of pool) {
    span.className = 'ripple-word';
    span.textContent = '';
  }
}

/**
 * Clear state so the same verse can trigger a ripple again.
 */
export function clearRippleState(): void {
  lastVerseKey = '';
  cancelRipple();
}
