// Scatter Effect - playful character scatter animation on verse pin
//
// When a verse is pinned, its Hebrew characters explode outward from the
// verse's screen position, pause, then drift back and fade out.
// Pure HTML/CSS overlay — does not touch the WebGL pipeline.

import type { VerseLayout } from './types';
import type { Camera } from './camera';

/** Maximum characters to animate (sample if verse is longer) */
const MAX_CHARS = 30;

/** Animation timing (ms) */
const SCATTER_DURATION = 400;
const PAUSE_DURATION = 200;
const GATHER_DURATION = 400;
const TOTAL_DURATION = SCATTER_DURATION + PAUSE_DURATION + GATHER_DURATION;

/** Scatter radius range in pixels */
const MIN_RADIUS = 80;
const MAX_RADIUS = 180;

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
 * Sample characters from Hebrew text, keeping at most MAX_CHARS.
 * Filters out spaces and common punctuation.
 */
function sampleCharacters(hebrewText: string): string[] {
  // Filter to meaningful characters (skip spaces, maqaf, sof pasuq)
  const chars = [...hebrewText].filter(ch => ch.trim() && ch !== '\u05BE' && ch !== '\u05C3');

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
 * Play the scatter animation for a pinned verse.
 *
 * @param verse - The verse being pinned
 * @param camera - Current camera state (for coordinate conversion)
 * @param hebrewText - The verse's Hebrew text
 */
export function playScatterEffect(
  verse: VerseLayout,
  camera: Camera,
  hebrewText: string,
): void {
  const { x: screenX, y: screenY } = worldToScreen(verse, camera);
  const chars = sampleCharacters(hebrewText);
  if (chars.length === 0) return;

  // Create container
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1000;
  `;
  document.body.appendChild(container);

  // Create a span for each character with a random trajectory
  for (const ch of chars) {
    const angle = Math.random() * Math.PI * 2;
    const radius = MIN_RADIUS + Math.random() * (MAX_RADIUS - MIN_RADIUS);
    const tx = Math.cos(angle) * radius;
    const ty = Math.sin(angle) * radius;
    const rotation = (Math.random() - 0.5) * 360;

    const span = document.createElement('span');
    span.textContent = ch;
    span.style.cssText = `
      position: absolute;
      left: ${screenX}px;
      top: ${screenY}px;
      font-size: 14px;
      font-family: 'SBL Hebrew', 'Ezra SIL', 'Times New Roman', serif;
      color: #d4a843;
      will-change: transform, opacity;
      pointer-events: none;
      transform: translate(-50%, -50%) translate(0px, 0px) rotate(0deg);
      opacity: 1;
    `;

    // Use CSS custom properties for the animation endpoint
    span.style.setProperty('--tx', `${tx}px`);
    span.style.setProperty('--ty', `${ty}px`);
    span.style.setProperty('--rot', `${rotation}deg`);

    container.appendChild(span);

    // Use Web Animations API for precise multi-phase animation
    span.animate(
      [
        // Start: at verse position
        {
          transform: 'translate(-50%, -50%) translate(0px, 0px) rotate(0deg)',
          opacity: 1,
          offset: 0,
        },
        // End of scatter: exploded outward
        {
          transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px) rotate(${rotation}deg)`,
          opacity: 0.9,
          offset: SCATTER_DURATION / TOTAL_DURATION,
        },
        // End of pause: hold position
        {
          transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px) rotate(${rotation}deg)`,
          opacity: 0.8,
          offset: (SCATTER_DURATION + PAUSE_DURATION) / TOTAL_DURATION,
        },
        // End of gather: back to origin, faded out
        {
          transform: 'translate(-50%, -50%) translate(0px, 0px) rotate(0deg)',
          opacity: 0,
          offset: 1,
        },
      ],
      {
        duration: TOTAL_DURATION,
        easing: 'ease-out',
        fill: 'forwards',
      },
    );
  }

  // Clean up DOM after animation completes
  setTimeout(() => {
    container.remove();
  }, TOTAL_DURATION + 50);
}
