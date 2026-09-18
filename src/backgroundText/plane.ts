// The background text as a second map behind the first. Every book's opening
// words fill that book's outline, and the whole plane is the map shrunk by the
// parallax ratio toward the screen centre. Nothing is chosen, so nothing
// depends on which verse is central.

import type { Camera } from '../camera.ts';
import type { TanakhLayout } from '../types.ts';
import type { VerseTexts } from '../verseTexts.ts';
import {
  bookBoxes,
  growBoxes,
  passageForRange,
  planeTransform,
  rangeFromStart,
  FONT_FAMILIES,
  type BackgroundTextSettings,
  type BookBox,
} from './model.ts';

const LINE_HEIGHT = 1.6;
const GLYPH_EM = 0.5;

export interface BackPlane {
  update(): void;
  setSettings(next: BackgroundTextSettings): void;
}

export function createBackPlane(options: {
  verses: TanakhLayout[];
  texts: VerseTexts;
  camera: Camera;
  settings: BackgroundTextSettings;
  container: HTMLElement;
  viewport: () => { width: number; height: number };
}): BackPlane {
  const { verses, texts, camera } = options;
  let settings = { ...options.settings };
  const outlines = bookBoxes(verses);
  const grown = growBoxes(outlines);
  let boxes = settings.planeGrow ? grown : outlines;

  const root = document.createElement('div');
  root.className = 'bgtext-plane';
  const blocks = boxes.map(() => {
    const el = document.createElement('div');
    el.className = 'bgtext-book';
    root.appendChild(el);
    return el;
  });
  options.container.appendChild(root);

  /** Lay each book's opening text into its box, in map units. */
  function build(): void {
    const font = settings.planeFont;
    boxes.forEach((box: BookBox, i) => {
      const width = box.right - box.left;
      const height = box.bottom - box.top;
      const el = blocks[i];
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
      el.style.fontSize = `${font}px`;
      // The estimate counts the marks that `marks` may strip, so grow until the
      // text overflows the outline rather than trusting it.
      let chars = (width / (font * GLYPH_EM)) * (height / (font * LINE_HEIGHT));
      for (let attempt = 0; attempt < 6; attempt++) {
        const range = rangeFromStart(verses, texts, box.first, chars);
        range.end = Math.min(range.end, box.last);
        el.textContent = passageForRange(verses, texts, range, settings.marks).verses.join(' ');
        if (el.scrollHeight > el.clientHeight || range.end === box.last) break;
        chars *= 1.5;
      }
    });
  }

  function applyStyle(): void {
    root.hidden = settings.follow !== 'plane';
    root.dataset.layer = settings.layer;
    root.style.setProperty('--bgtext-opacity', String(settings.opacity));
    root.style.fontFamily = FONT_FAMILIES[settings.font];
    root.style.mixBlendMode = settings.blend;
  }

  function update(): void {
    if (settings.follow !== 'plane') return;
    const vp = options.viewport();
    const center = { x: vp.width / 2, y: vp.height / 2 };
    boxes.forEach((box, i) => {
      const t = planeTransform(box.left, box.top, camera, settings.parallax, center);
      blocks[i].style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
    });
  }

  function setSettings(next: BackgroundTextSettings): void {
    const rebuild =
      next.planeFont !== settings.planeFont ||
      next.marks !== settings.marks ||
      next.planeGrow !== settings.planeGrow;
    settings = { ...next };
    boxes = settings.planeGrow ? grown : outlines;
    applyStyle();
    if (rebuild) build();
    update();
  }

  build();
  applyStyle();
  return { update, setSettings };
}
