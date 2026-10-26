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
      display:flex;
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
  return (pan, zoom) => {
    container.style.transform = `translate(${pan.x * zoom}px, ${pan.y * zoom}px)`;
    const shown = zoom >= MISHNAH_LETTER_ZOOM;
    container.style.display = shown ? '' : 'none';
    if (!shown) return;
    const side = drawn * zoom;
    marks.forEach(({ item }, i) => {
      const style = letters[i].style;
      style.left = `${(item.x + (item.jitter?.x ?? 0)) * zoom}px`;
      style.top = `${(item.y + (item.jitter?.y ?? 0)) * zoom}px`;
      style.width = `${side}px`;
      style.height = `${side}px`;
      style.fontSize = `${side * 0.85}px`;
    });
  };
}
