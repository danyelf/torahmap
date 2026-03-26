// Verse Whisper - calligraphic text reveal on hover
// Shows Hebrew text flowing out from the hovered verse, character by character

import type { VerseLayout } from './types.ts';
import type { Camera } from './camera.ts';
import type { VerseTexts } from './verseTexts.ts';
import { getVerseText } from './verseTexts.ts';

const CHAR_DELAY_MS = 30;       // Time between each character reveal
const FADE_OUT_MS = 300;        // Fade-out duration when hover leaves
const MAX_CHARS = 60;           // Maximum characters to display
const TEXT_COLOR = '#f0e6d2';   // Cream/off-white
const TEXT_OPACITY = 0.7;
const BASE_FONT_SIZE = 16;      // Font size at zoom=1
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 40;
const TEXT_GAP = 8;             // Gap between verse square and text (in screen px)

interface WhisperState {
  container: HTMLDivElement;
  currentVerse: VerseLayout | null;
  revealedCount: number;
  fullText: string;
  intervalId: ReturnType<typeof setInterval> | null;
  isFadingOut: boolean;
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
 * Create the whisper overlay container.
 */
export function createWhisperOverlay(): WhisperState {
  const container = document.createElement('div');
  container.id = 'verse-whisper';
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 10;
    color: ${TEXT_COLOR};
    opacity: ${TEXT_OPACITY};
    font-family: "Noto Serif Hebrew", "David Libre", "Frank Ruhl Libre", "Noto Sans Hebrew", serif;
    text-shadow: 0 1px 4px rgba(30, 20, 10, 0.6);
    white-space: nowrap;
    direction: rtl;
    transition: opacity ${FADE_OUT_MS}ms ease-out;
  `;
  document.body.appendChild(container);

  return {
    container,
    currentVerse: null,
    revealedCount: 0,
    fullText: '',
    intervalId: null,
    isFadingOut: false,
  };
}

/**
 * Stop any ongoing character reveal animation.
 */
function stopAnimation(state: WhisperState): void {
  if (state.intervalId !== null) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
}

/**
 * Start fading out the whisper text.
 */
function fadeOut(state: WhisperState): void {
  stopAnimation(state);
  state.isFadingOut = true;
  state.container.style.opacity = '0';

  // After fade completes, clear the element
  setTimeout(() => {
    if (state.isFadingOut) {
      state.container.textContent = '';
      state.currentVerse = null;
      state.fullText = '';
      state.revealedCount = 0;
      state.isFadingOut = false;
    }
  }, FADE_OUT_MS);
}

/**
 * Check if two verses are the same.
 */
function sameVerse(a: VerseLayout | null, b: VerseLayout | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.book === b.book && a.chapter === b.chapter && a.verse === b.verse;
}

/**
 * Update the whisper display for a new hovered verse.
 */
export function updateWhisper(
  state: WhisperState,
  verse: VerseLayout | null,
  camera: Camera,
  verseTexts: VerseTexts
): void {
  // No verse hovered - fade out
  if (!verse) {
    if (state.currentVerse !== null && !state.isFadingOut) {
      fadeOut(state);
    }
    return;
  }

  // Same verse as before - just update position
  if (sameVerse(verse, state.currentVerse) && !state.isFadingOut) {
    positionWhisper(state, verse, camera);
    return;
  }

  // New verse - start fresh
  stopAnimation(state);
  state.isFadingOut = false;
  state.currentVerse = verse;
  state.revealedCount = 0;

  // Get the Hebrew text
  const text = getVerseText(verseTexts, verse.book, verse.chapter, verse.verse);
  if (!text || !text.he) {
    state.container.textContent = '';
    state.container.style.opacity = '0';
    return;
  }

  // Truncate if needed
  let hebrewText = text.he;
  if (hebrewText.length > MAX_CHARS) {
    hebrewText = hebrewText.slice(0, MAX_CHARS) + '...';
  }
  state.fullText = hebrewText;

  // Position and show
  state.container.style.opacity = String(TEXT_OPACITY);
  state.container.textContent = '';
  positionWhisper(state, verse, camera);

  // Start character-by-character reveal
  state.intervalId = setInterval(() => {
    state.revealedCount++;
    if (state.revealedCount >= state.fullText.length) {
      stopAnimation(state);
      state.container.textContent = state.fullText;
    } else {
      state.container.textContent = state.fullText.slice(0, state.revealedCount);
    }
  }, CHAR_DELAY_MS);
}

/**
 * Position the whisper text next to the verse.
 */
function positionWhisper(
  state: WhisperState,
  verse: VerseLayout,
  camera: Camera
): void {
  // Compute font size scaled with zoom
  const fontSize = Math.max(
    MIN_FONT_SIZE,
    Math.min(MAX_FONT_SIZE, BASE_FONT_SIZE * camera.zoom)
  );
  state.container.style.fontSize = fontSize + 'px';

  // Get screen position of verse's left edge, vertically centered
  const verseScreenPos = worldToScreen(verse.x, verse.y + verse.size / 2, camera);

  // Position to the left of the verse
  // The text is RTL so it naturally extends leftward from the anchor point
  const screenX = verseScreenPos.x - TEXT_GAP;
  const screenY = verseScreenPos.y;

  state.container.style.left = screenX + 'px';
  state.container.style.top = screenY + 'px';
  state.container.style.transform = 'translateY(-50%)';
}

/**
 * Update whisper position without changing content (e.g., during pan/zoom).
 */
export function repositionWhisper(
  state: WhisperState,
  camera: Camera
): void {
  if (state.currentVerse && !state.isFadingOut) {
    positionWhisper(state, state.currentVerse, camera);
  }
}

/**
 * Clean up the whisper overlay.
 */
export function destroyWhisper(state: WhisperState): void {
  stopAnimation(state);
  state.container.remove();
}
