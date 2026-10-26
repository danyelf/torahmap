// A letter on the first square of each Mishnah (מ) and of the Gemara after it (ג).

import { SQUARE_GAP } from '@torahmap/engine';
import { HEBREW_LABEL_FONT } from '@torahmap/shell/labelTypography.ts';
import { MISHNAH_LETTER_ZOOM, SEGMENT_SIZE } from './constants.ts';
import type { TalmudLayoutItem } from './layout.ts';

export interface Mark {
  item: TalmudLayoutItem;
  letter: 'מ' | 'ג';
}

/** The squares that get a letter, from the items in reading order. The Mishnah's squares are the round ones. */
export function mishnahMarks(items: readonly TalmudLayoutItem[]): Mark[] {
  const marks: Mark[] = [];
  let tractate = '';
  let inMishnah = false;
  for (const item of items) {
    if (item.tractate !== tractate) {
      tractate = item.tractate;
      inMishnah = false;
    }
    const mishnah = item.round === true;
    if (mishnah && !inMishnah) marks.push({ item, letter: 'מ' });
    if (!mishnah && inMishnah) marks.push({ item, letter: 'ג' });
    inMishnah = mishnah;
  }
  return marks;
}

/** Draws the letters inside `parent`, and returns what moves them with the map. */
export function createMishnahLetters(
  items: readonly TalmudLayoutItem[],
  parent: HTMLElement,
): (pan: { x: number; y: number }, zoom: number) => void {
  const marks = mishnahMarks(items);
  const container = document.createElement('div');
  container.id = 'talmud-mishnah-letters';
  container.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;';
  const letters = marks.map(({ letter }) => {
    const el = document.createElement('div');
    el.textContent = letter;
    el.style.cssText = `
      position:absolute;
      display:none;
      align-items:center;
      justify-content:center;
      font-family:${HEBREW_LABEL_FONT};
      font-weight:700;
      line-height:1;
      color:#f4efe2;
      text-shadow:0 0 3px #000, 0 0 2px #000;
    `;
    container.appendChild(el);
    return el;
  });
  parent.appendChild(container);

  const drawn = SEGMENT_SIZE - SQUARE_GAP;
  // The zoom each letter was last placed at, or 0 while it is hidden. Panning moves only the
  // container; a letter is placed again when it comes on screen at a new zoom. Placing all
  // 4,000 on every frame made panning cost twice what it does without them.
  const placedAt = marks.map(() => 0);
  return (pan, zoom) => {
    container.style.transform = `translate(${pan.x * zoom}px, ${pan.y * zoom}px)`;
    const shown = zoom >= MISHNAH_LETTER_ZOOM;
    container.style.display = shown ? '' : 'none';
    if (!shown) return;
    const view = onScreen(pan, zoom, parent.clientWidth, parent.clientHeight, drawn);
    const side = drawn * zoom;
    marks.forEach(({ item }, i) => {
      const style = letters[i].style;
      const x = item.x + (item.jitter?.x ?? 0);
      const y = item.y + (item.jitter?.y ?? 0);
      if (!view(x, y)) {
        if (placedAt[i]) style.display = 'none';
        placedAt[i] = 0;
        return;
      }
      if (placedAt[i] === zoom) return;
      placedAt[i] = zoom;
      style.display = 'flex';
      style.left = `${x * zoom}px`;
      style.top = `${y * zoom}px`;
      style.width = `${side}px`;
      style.height = `${side}px`;
      style.fontSize = `${side * 0.85}px`;
    });
  };
}

/** Whether a square of side `side` at map point (x, y) shows in a screen of `width` × `height`. */
export function onScreen(
  pan: { x: number; y: number },
  zoom: number,
  width: number,
  height: number,
  side: number,
): (x: number, y: number) => boolean {
  const left = -pan.x - side;
  const top = -pan.y - side;
  const right = -pan.x + width / zoom;
  const bottom = -pan.y + height / zoom;
  return (x, y) => x > left && x < right && y > top && y < bottom;
}
