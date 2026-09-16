// The DOM half of the background text. Two stacked pages: one in front, one
// waiting. A regeneration fills the waiting page, measures it, and crossfades.
// Every frame both pages are moved by a CSS transform computed from the camera.
// A WebGL text path would replace this file and nothing else.

import type { Camera } from './camera.ts';
import type { TanakhLayout } from './types.ts';
import type { VerseTexts } from './verseTexts.ts';
import { screenToWorld } from './hitDetection.ts';
import {
  anchorWorldPoint,
  fontSizeForZoom,
  nearestVerseIndex,
  pageTransform,
  passageAround,
  shouldRegenerate,
  worldToScreen,
  FONT_FAMILIES,
  type BackgroundTextSettings,
  type PagePlacement,
} from './backgroundText.ts';

// Pages are laid out once at this size; zoom applies a CSS scale on top, so a
// zoom never reflows the paragraph.
const BASE_FONT_PX = 16;

interface Page {
  el: HTMLDivElement;
  placement: PagePlacement | null;
}

export interface BackgroundTextLayer {
  /** Reposition the pages for the current camera, regenerating if the center verse moved far enough. */
  update(): void;
  setSettings(next: BackgroundTextSettings): void;
  getSettings(): BackgroundTextSettings;
}

export function createBackgroundTextLayer(options: {
  verses: TanakhLayout[];
  texts: VerseTexts;
  camera: Camera;
  settings: BackgroundTextSettings;
  container: HTMLElement;
}): BackgroundTextLayer {
  const { verses, texts, camera } = options;
  let settings = { ...options.settings };

  const root = document.createElement('div');
  root.id = 'bgtext';
  const pages: Page[] = [0, 1].map(() => {
    const el = document.createElement('div');
    el.className = 'bgtext-page';
    el.style.fontSize = `${BASE_FONT_PX}px`;
    root.appendChild(el);
    return { el, placement: null };
  });
  options.container.appendChild(root);

  let front = 0;
  let builtAround: number | null = null;
  let settleTimer: number | null = null;

  function applyStyle(): void {
    root.dataset.layer = settings.layer;
    root.style.setProperty('--bgtext-opacity', String(settings.opacity));
    root.style.setProperty('--bgtext-fade', `${settings.crossfadeMs}ms`);
    root.style.fontFamily = FONT_FAMILIES[settings.font];
    for (const page of pages) page.el.style.mixBlendMode = settings.blend;
  }

  // The part of the window the map is actually visible in: the right panel
  // covers a strip of it, and the passage should sit in the middle of the rest.
  function viewport(): { width: number; height: number } {
    const panel = document.getElementById('right-panel');
    const covered = panel && panel.offsetWidth > 0 ? panel.offsetWidth : 0;
    return { width: window.innerWidth - covered, height: window.innerHeight };
  }

  function centerVerseIndex(): number {
    const vp = viewport();
    const world = screenToWorld(vp.width / 2, vp.height / 2, camera);
    return nearestVerseIndex(verses, world.x, world.y);
  }

  function build(centerIndex: number): void {
    const page = pages[1 - front];
    const old = pages[front];
    const verse = verses[centerIndex];
    const passage = passageAround(verses, texts, centerIndex, settings);

    page.el.style.width = `${settings.widthEm * BASE_FONT_PX}px`;
    const center = document.createElement('span');
    center.className = 'bgtext-center';
    center.textContent = passage.center;
    page.el.replaceChildren(
      document.createTextNode(passage.before ? `${passage.before} ` : ''),
      center,
      document.createTextNode(passage.after ? ` ${passage.after}` : ''),
    );

    // Measure the reference point unscaled, relative to the page's own
    // top-left. Vertically it is the top of the center verse's first line.
    // Horizontally, a square anchor wants the verse's first word (the right
    // end of that line) on the square; a viewport anchor wants the paragraph
    // centred on the screen.
    page.el.style.transform = 'none';
    const pageRect = page.el.getBoundingClientRect();
    const firstLine = center.getClientRects()[0] ?? pageRect;
    const refOffset = {
      x: settings.anchor === 'square' ? firstLine.right - pageRect.left : pageRect.width / 2,
      y: firstLine.top - pageRect.top,
    };

    const anchorWorld = anchorWorldPoint(settings.anchor, verse, camera, viewport());
    page.placement = {
      anchorWorld,
      anchorScreenAtBuild: worldToScreen(anchorWorld.x, anchorWorld.y, camera),
      refOffset,
    };
    builtAround = centerIndex;
    front = 1 - front;
    place(page);
    page.el.classList.add('front');
    old.el.classList.remove('front');
  }

  function place(page: Page): void {
    if (!page.placement) return;
    const scale = fontSizeForZoom(camera.zoom, settings.minFont, settings.maxFont) / BASE_FONT_PX;
    const t = pageTransform(page.placement, camera, settings.parallax, scale);
    page.el.style.transform = `translate(${t.x}px, ${t.y}px) scale(${scale})`;
  }

  function maybeRegenerate(): void {
    const center = centerVerseIndex();
    if (!shouldRegenerate(builtAround, center, settings.hysteresis)) return;
    if (settings.settleMs === 0) {
      build(center);
      return;
    }
    if (settleTimer !== null) window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      settleTimer = null;
      const settled = centerVerseIndex();
      if (shouldRegenerate(builtAround, settled, settings.hysteresis)) {
        build(settled);
      }
    }, settings.settleMs);
  }

  function update(): void {
    maybeRegenerate();
    for (const page of pages) place(page);
  }

  function setSettings(next: BackgroundTextSettings): void {
    settings = { ...next };
    applyStyle();
    if (settleTimer !== null) {
      window.clearTimeout(settleTimer);
      settleTimer = null;
    }
    build(centerVerseIndex());
    for (const page of pages) place(page);
  }

  applyStyle();
  return { update, setSettings, getSettings: () => ({ ...settings }) };
}
