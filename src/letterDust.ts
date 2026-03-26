// Letter Dust - whimsical hover effect where Hebrew characters rise off a verse like embers

import type { Camera } from './camera';
import type { VerseLayout } from './types';

// CSS animation injected once
let styleInjected = false;

function injectStyles(): void {
  if (styleInjected) return;
  styleInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes letter-dust-rise {
      0% {
        opacity: 0.9;
        transform: translate(var(--dust-x0), 0px) scale(1);
      }
      100% {
        opacity: 0;
        transform: translate(var(--dust-x1), var(--dust-y1)) scale(var(--dust-scale));
      }
    }
    .letter-dust {
      position: fixed;
      pointer-events: none;
      font-family: "Noto Sans Hebrew", "SBL Hebrew", serif;
      color: #ffd780;
      text-shadow: 0 0 4px rgba(255, 180, 50, 0.6);
      animation: letter-dust-rise var(--dust-duration) ease-out forwards;
      z-index: 1000;
      will-change: transform, opacity;
      direction: rtl;
    }
  `;
  document.head.appendChild(style);
}

// Container for dust particles
let container: HTMLDivElement | null = null;

function getContainer(): HTMLDivElement {
  if (!container) {
    container = document.createElement('div');
    container.id = 'letter-dust-container';
    container.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:1000;';
    document.body.appendChild(container);
  }
  return container;
}

// Track active particle count and cooldown
let activeParticles = 0;
const MAX_PARTICLES = 30;
let lastSpawnTime = 0;
const COOLDOWN_MS = 150;

// Track last verse to avoid re-triggering on same verse
let lastVerseKey = '';

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
 * Spawn letter dust particles for a hovered verse.
 * Call this from the hover handler when a new verse is hovered.
 *
 * @param verse - The hovered verse layout
 * @param hebrewText - Hebrew text of the verse
 * @param camera - Current camera state
 */
export function spawnLetterDust(
  verse: VerseLayout,
  hebrewText: string,
  camera: Camera,
): void {
  const now = Date.now();
  if (now - lastSpawnTime < COOLDOWN_MS) return;

  const verseKey = `${verse.book}:${verse.chapter}:${verse.verse}`;
  if (verseKey === lastVerseKey) return;
  lastVerseKey = verseKey;
  lastSpawnTime = now;

  injectStyles();
  const cont = getContainer();

  // Get screen position of the verse center
  const centerX = verse.x + verse.size / 2;
  const centerY = verse.y + verse.size / 2;
  const screen = worldToScreen(centerX, centerY, camera);

  // Pick a subset of Hebrew characters (skip spaces, punctuation)
  const hebrewChars = hebrewText
    .split('')
    .filter(ch => /[\u0590-\u05FF]/.test(ch));

  if (hebrewChars.length === 0) return;

  // Pick up to 8 random characters
  const count = Math.min(8, hebrewChars.length);
  const budget = MAX_PARTICLES - activeParticles;
  if (budget <= 0) return;
  const toSpawn = Math.min(count, budget);

  // Shuffle and take first N
  const shuffled = hebrewChars.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const verseScreenSize = verse.size * camera.zoom;
  const fontSize = Math.max(10, Math.min(24, verseScreenSize * 1.5));

  for (let i = 0; i < toSpawn; i++) {
    const char = shuffled[i];
    const span = document.createElement('span');
    span.className = 'letter-dust';
    span.textContent = char;

    // Randomize starting position within the verse square
    const offsetX = (Math.random() - 0.5) * verseScreenSize;
    const offsetY = (Math.random() - 0.5) * verseScreenSize;

    // Randomize drift
    const driftX = (Math.random() - 0.5) * 60; // horizontal wobble
    const riseY = -(40 + Math.random() * 80);   // upward drift
    const duration = 0.7 + Math.random() * 0.6;  // 0.7-1.3s
    const scale = 1.0 + Math.random() * 0.5;     // slight scale up
    const delay = i * 40;                         // stagger

    span.style.left = `${screen.x + offsetX}px`;
    span.style.top = `${screen.y + offsetY}px`;
    span.style.fontSize = `${fontSize}px`;
    span.style.setProperty('--dust-x0', `${0}px`);
    span.style.setProperty('--dust-x1', `${driftX}px`);
    span.style.setProperty('--dust-y1', `${riseY}px`);
    span.style.setProperty('--dust-duration', `${duration}s`);
    span.style.setProperty('--dust-scale', `${scale}`);
    span.style.animationDelay = `${delay}ms`;

    activeParticles++;
    cont.appendChild(span);

    // Clean up after animation finishes
    const totalTime = (duration * 1000) + delay + 50;
    setTimeout(() => {
      span.remove();
      activeParticles--;
    }, totalTime);
  }
}

/**
 * Reset the last verse key so the same verse can trigger again
 * (e.g., when the user leaves and returns to it).
 */
export function clearLetterDustState(): void {
  lastVerseKey = '';
}
