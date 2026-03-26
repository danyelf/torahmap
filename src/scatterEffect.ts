// Scatter Effect - hover-triggered character jostle animation
//
// When hovering over a verse, its Hebrew characters appear and jostle outward
// like startled birds. When the mouse leaves, they drift back and fade out.
// Pure HTML/CSS overlay — does not touch the WebGL pipeline.

import type { VerseLayout } from './types';
import type { Camera } from './camera';

/** Maximum characters to show */
const MAX_CHARS = 40;

/** Jostle radius range in pixels — subtle, not a full explosion */
const MIN_RADIUS = 12;
const MAX_RADIUS = 35;

/** How fast characters jostle out (ms) */
const SCATTER_IN_MS = 250;
/** How fast characters gather back when mouse leaves (ms) */
const GATHER_MS = 350;

/** Currently active scatter state, keyed by verse identity */
let activeEffect: {
  verseKey: string;
  container: HTMLElement;
  spans: HTMLSpanElement[];
  animations: Animation[];
  phase: 'scattering' | 'scattered' | 'gathering';
} | null = null;

function verseKey(v: VerseLayout): string {
  return `${v.book}:${v.chapter}:${v.verse}`;
}

/**
 * Convert a verse's world position to screen coordinates.
 */
function worldToScreen(
  verse: VerseLayout,
  camera: Camera,
): { x: number; y: number } {
  const centerX = verse.x + verse.size / 2;
  const centerY = verse.y + verse.size / 2;
  return {
    x: (centerX + camera.x) * camera.zoom,
    y: (centerY + camera.y) * camera.zoom,
  };
}

/**
 * Extract characters from Hebrew text, keeping at most MAX_CHARS.
 * Returns characters in reading order (RTL — first char is rightmost).
 * Filters out spaces and common punctuation but keeps nikkud attached.
 */
function extractCharacters(hebrewText: string): string[] {
  // Filter to meaningful characters (skip spaces, maqaf, sof pasuq)
  const chars = [...hebrewText].filter(
    (ch) => ch.trim() && ch !== '\u05BE' && ch !== '\u05C3',
  );

  if (chars.length <= MAX_CHARS) return chars;

  // Evenly sample from the text
  const result: string[] = [];
  const step = chars.length / MAX_CHARS;
  for (let i = 0; i < MAX_CHARS; i++) {
    result.push(chars[Math.floor(i * step)]);
  }
  return result;
}

/**
 * Lay out characters in a gentle arc / cluster around the verse center,
 * so they initially read as text before jostling.
 * Returns [{dx, dy}] offsets from center for each character's "home" position.
 */
function homePositions(
  count: number,
): { dx: number; dy: number }[] {
  const positions: { dx: number; dy: number }[] = [];
  // Arrange in rows, roughly centered, RTL reading order
  const charsPerRow = Math.ceil(Math.sqrt(count * 2.5));
  const charW = 11;
  const lineH = 16;
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / charsPerRow);
    const col = i % charsPerRow;
    const rowCount = Math.min(charsPerRow, count - row * charsPerRow);
    // Center each row; RTL so col 0 is rightmost
    const dx = (rowCount / 2 - col) * charW;
    const dy = (row - Math.floor(count / charsPerRow) / 2) * lineH;
    positions.push({ dx, dy });
  }
  return positions;
}

/**
 * Called on every hover change. Manages the lifecycle of the scatter effect.
 *
 * @param verse - The verse currently hovered (or null if none)
 * @param camera - Current camera state
 * @param hebrewText - The verse's Hebrew text (or empty/null if not loaded)
 */
export function updateScatterHover(
  verse: VerseLayout | null,
  camera: Camera,
  hebrewText: string | null,
): void {
  const newKey = verse ? verseKey(verse) : null;
  const currentKey = activeEffect?.verseKey ?? null;

  // Same verse — just update positions if camera moved
  if (newKey && newKey === currentKey && activeEffect) {
    repositionContainer(verse!, camera);
    return;
  }

  // Different verse or left all verses — gather the old one
  if (activeEffect && activeEffect.phase !== 'gathering') {
    gatherAndRemove(activeEffect);
    activeEffect = null;
  }

  // Nothing to show
  if (!verse || !hebrewText) return;

  // Create new scatter effect for the hovered verse
  const { x: screenX, y: screenY } = worldToScreen(verse, camera);
  const chars = extractCharacters(hebrewText);
  if (chars.length === 0) return;

  const homes = homePositions(chars.length);

  // Container
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    z-index: 1000;
  `;
  // Store screen origin so we can update on camera moves
  container.dataset.originX = String(screenX);
  container.dataset.originY = String(screenY);
  document.body.appendChild(container);

  const spans: HTMLSpanElement[] = [];
  const animations: Animation[] = [];

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const home = homes[i];

    // Random jostle target — small displacement from home
    const angle = Math.random() * Math.PI * 2;
    const radius = MIN_RADIUS + Math.random() * (MAX_RADIUS - MIN_RADIUS);
    const jx = home.dx + Math.cos(angle) * radius;
    const jy = home.dy + Math.sin(angle) * radius;
    const rotation = (Math.random() - 0.5) * 40; // subtle rotation

    const span = document.createElement('span');
    span.textContent = ch;
    span.style.cssText = `
      position: absolute;
      left: ${screenX}px;
      top: ${screenY}px;
      font-size: 13px;
      font-family: 'SBL Hebrew', 'Ezra SIL', 'Times New Roman', serif;
      color: #d4a843;
      will-change: transform, opacity;
      pointer-events: none;
      transform: translate(-50%, -50%) translate(${home.dx}px, ${home.dy}px);
      opacity: 0;
    `;

    container.appendChild(span);
    spans.push(span);

    // Phase 1: fade in at home, then jostle outward
    const stagger = i * 8; // slight stagger for organic feel
    const anim = span.animate(
      [
        {
          transform: `translate(-50%, -50%) translate(${home.dx}px, ${home.dy}px) rotate(0deg)`,
          opacity: 0,
          offset: 0,
        },
        {
          transform: `translate(-50%, -50%) translate(${home.dx}px, ${home.dy}px) rotate(0deg)`,
          opacity: 0.95,
          offset: 0.2,
        },
        {
          transform: `translate(-50%, -50%) translate(${jx}px, ${jy}px) rotate(${rotation}deg)`,
          opacity: 0.85,
          offset: 1,
        },
      ],
      {
        duration: SCATTER_IN_MS + stagger,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // slight overshoot
        fill: 'forwards',
        delay: stagger,
      },
    );
    animations.push(anim);
  }

  activeEffect = {
    verseKey: newKey!,
    container,
    spans,
    animations,
    phase: 'scattering',
  };

  // Mark as scattered once initial animation done
  const longestDuration = SCATTER_IN_MS + chars.length * 8 * 2;
  setTimeout(() => {
    if (activeEffect?.verseKey === newKey) {
      activeEffect.phase = 'scattered';
      // Add gentle continuous drift
      addIdleDrift(activeEffect);
    }
  }, longestDuration);
}

/**
 * Add a gentle continuous wobble to scattered characters.
 */
function addIdleDrift(effect: typeof activeEffect): void {
  if (!effect || effect.phase !== 'scattered') return;

  for (const span of effect.spans) {
    // Get current computed transform and add a subtle looping wiggle
    const wiggleX = (Math.random() - 0.5) * 6;
    const wiggleY = (Math.random() - 0.5) * 6;
    const wiggleR = (Math.random() - 0.5) * 8;
    const duration = 800 + Math.random() * 600;

    const current = getComputedStyle(span).transform;
    // Parse current position isn't trivial, so just apply a relative animation
    span.animate(
      [
        { transform: `${current} translate(0px, 0px) rotate(0deg)` },
        { transform: `${current} translate(${wiggleX}px, ${wiggleY}px) rotate(${wiggleR}deg)` },
        { transform: `${current} translate(0px, 0px) rotate(0deg)` },
      ],
      {
        duration,
        iterations: Infinity,
        easing: 'ease-in-out',
      },
    );
  }
}

/**
 * Animate characters back to home position and then remove.
 */
function gatherAndRemove(effect: NonNullable<typeof activeEffect>): void {
  effect.phase = 'gathering';

  // Cancel existing animations
  for (const anim of effect.animations) {
    anim.cancel();
  }
  // Also cancel any idle drift animations
  for (const span of effect.spans) {
    span.getAnimations().forEach((a) => a.cancel());
  }

  const { spans, container } = effect;

  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    const current = getComputedStyle(span).transform;

    span.animate(
      [
        { transform: current, opacity: 0.8 },
        { transform: 'translate(-50%, -50%) translate(0px, 0px)', opacity: 0 },
      ],
      {
        duration: GATHER_MS,
        easing: 'ease-in',
        fill: 'forwards',
      },
    );
  }

  setTimeout(() => {
    container.remove();
  }, GATHER_MS + 50);
}

/**
 * Reposition the container when camera moves while hovering.
 */
function repositionContainer(verse: VerseLayout, camera: Camera): void {
  if (!activeEffect) return;
  const { x: newX, y: newY } = worldToScreen(verse, camera);
  const oldX = parseFloat(activeEffect.container.dataset.originX ?? '0');
  const oldY = parseFloat(activeEffect.container.dataset.originY ?? '0');
  const dx = newX - oldX;
  const dy = newY - oldY;

  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

  // Shift all spans
  for (const span of activeEffect.spans) {
    const left = parseFloat(span.style.left);
    const top = parseFloat(span.style.top);
    span.style.left = `${left + dx}px`;
    span.style.top = `${top + dy}px`;
  }
  activeEffect.container.dataset.originX = String(newX);
  activeEffect.container.dataset.originY = String(newY);
}

/**
 * Clean up any active scatter effect immediately (e.g., on overlay change).
 */
export function clearScatterEffect(): void {
  if (activeEffect) {
    activeEffect.container.remove();
    activeEffect = null;
  }
}
