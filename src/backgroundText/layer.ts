// The DOM half of the background text. Two stacked pages: one in front, one
// waiting. A regeneration fills the waiting page, measures it, and crossfades.
// Every frame both pages are moved by a CSS transform computed from the camera.
// A WebGL text path would replace this file and nothing else.

import type { Camera } from '../camera.ts';
import type { TanakhLayout } from '../types.ts';
import type { VerseTexts } from '../verseTexts.ts';
import { screenToWorld } from '../hitDetection.ts';
import {
  advancePlacement,
  anchorWorldPoint,
  dominantUnitStart,
  fontSizeForZoom,
  lineGridSnap,
  nearestVerseIndex,
  newPlacement,
  pageTransform,
  passageAround,
  passageForRange,
  rangeFromStart,
  rangeToFill,
  shouldRegenerate,
  worldToScreen,
  FONT_FAMILIES,
  type BackgroundTextSettings,
  type PagePlacement,
  type Passage,
} from './model.ts';

// Pages are laid out once at this size; zoom applies a CSS scale on top, so a
// zoom never reflows the paragraph.
const BASE_FONT_PX = 16;
// Matches line-height in the stylesheet; the line grid snap needs the pitch.
const LINE_HEIGHT = 1.6;
// In fill mode the page overhangs the viewport by this factor on each axis, so
// parallax drift between rebuilds does not reveal an edge.
const FILL_BLEED = 1.3;
// Rough average width of a Hebrew glyph plus its share of spaces, in em.
const GLYPH_EM = 0.5;
// A zoom that changes the page scale by more than this since the page was
// built triggers a rebuild, so a filled page keeps covering the viewport.
const RESCALE_REBUILD_RATIO = 1.15;

interface Page {
  el: HTMLDivElement;
  placement: PagePlacement | null;
  /** One span per verse, the first being verse number `start`. */
  spans: HTMLSpanElement[];
  start: number;
}

export interface BackgroundTextLayer {
  /** Reposition the pages for the current camera, regenerating if the center verse moved far enough. */
  update(): void;
  setSettings(next: BackgroundTextSettings): void;
  getSettings(): BackgroundTextSettings;
}

function verseKey(v: TanakhLayout): string {
  return `${v.book} ${v.chapter}:${v.verse}`;
}

export function createBackgroundTextLayer(options: {
  verses: TanakhLayout[];
  texts: VerseTexts;
  camera: Camera;
  settings: BackgroundTextSettings;
  container: HTMLElement;
  /** The verses to light up, such as the hovered and the pinned one. */
  litVerses: () => (TanakhLayout | null)[];
}): BackgroundTextLayer {
  const { verses, texts, camera } = options;
  const indexOf = new Map(verses.map((v, i) => [verseKey(v), i]));
  let settings = { ...options.settings };

  const root = document.createElement('div');
  root.id = 'bgtext';
  const pages: Page[] = [0, 1].map(() => {
    const el = document.createElement('div');
    el.className = 'bgtext-page';
    el.style.fontSize = `${BASE_FONT_PX}px`;
    root.appendChild(el);
    return { el, placement: null, spans: [], start: 0 };
  });
  options.container.appendChild(root);

  let front = 0;
  let builtAround: number | null = null;
  let settleTimer: number | null = null;
  let lastZoom = camera.zoom;

  function applyStyle(): void {
    root.dataset.layer = settings.layer;
    root.style.setProperty('--bgtext-opacity', String(settings.opacity));
    root.style.setProperty('--bgtext-lit-opacity', String(settings.litOpacity));
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

  function currentScale(): number {
    return fontSizeForZoom(camera.zoom, settings.minFont, settings.maxFont) / BASE_FONT_PX;
  }

  /** Put a passage into a page, a span per verse, and return the center verse's span. */
  function fillPage(page: Page, passage: Passage, centerIndex: number): HTMLSpanElement {
    page.start = passage.start;
    page.spans = passage.verses.map((text) => {
      const span = document.createElement('span');
      span.textContent = text;
      return span;
    });
    page.el.replaceChildren();
    page.spans.forEach((span, i) => {
      if (i > 0) page.el.append(' ');
      page.el.append(span);
    });
    return page.spans[centerIndex - passage.start];
  }

  /**
   * Fill mode: size the page to overhang the viewport and pull in verses
   * until the paragraph is at least that tall. The first estimate is from
   * average glyph width; if it falls short, grow the range and try again.
   */
  function buildFilled(page: Page, centerIndex: number, scale: number): HTMLSpanElement {
    const vp = viewport();
    const pageWidth = (vp.width * FILL_BLEED) / scale;
    const targetHeight = (vp.height * FILL_BLEED) / scale;
    page.el.style.width = `${pageWidth}px`;
    const charsPerLine = pageWidth / (BASE_FONT_PX * GLYPH_EM);
    let targetChars = charsPerLine * (targetHeight / (BASE_FONT_PX * LINE_HEIGHT));
    let center: HTMLSpanElement;
    for (let attempt = 0; ; attempt++) {
      const range =
        settings.follow === 'verse'
          ? rangeToFill(verses, texts, centerIndex, targetChars)
          : rangeFromStart(verses, texts, centerIndex, targetChars);
      center = fillPage(page, passageForRange(verses, texts, range, settings.marks), centerIndex);
      const wholeCorpus = range.start === 0 && range.end === verses.length - 1;
      if (page.el.offsetHeight >= targetHeight || wholeCorpus || attempt >= 4) break;
      targetChars *= 1.3;
    }
    return center;
  }

  function build(centerIndex: number): void {
    const page = pages[1 - front];
    const old = pages[front];
    const verse = verses[centerIndex];
    const scale = currentScale();

    // Lay the page out unscaled so the measurements below are in page pixels.
    page.el.style.transform = 'none';
    let center: HTMLSpanElement;
    if (settings.content === 'fill') {
      center = buildFilled(page, centerIndex, scale);
    } else {
      page.el.style.width = `${settings.widthEm * BASE_FONT_PX}px`;
      center = fillPage(page, passageAround(verses, texts, centerIndex, settings), centerIndex);
    }

    // The reference point, relative to the page's own top-left. Vertically
    // it is the top of the center verse's first line. Horizontally, a square
    // anchor wants the verse's first word (the right end of that line) on the
    // square; a viewport anchor wants the paragraph centred on the screen.
    // Following a book or chapter, the page instead hangs from the top centre
    // of the screen, so the unit's opening words are the first line.
    const pageRect = page.el.getBoundingClientRect();
    const firstLine = center.getClientRects()[0] ?? pageRect;
    const byUnit = settings.follow !== 'verse';
    const refOffset = {
      x:
        settings.anchor === 'square' && !byUnit
          ? firstLine.right - pageRect.left
          : pageRect.width / 2,
      y: byUnit ? 0 : firstLine.top - pageRect.top,
    };

    const anchorWorld = byUnit
      ? screenToWorld(viewport().width / 2, 0, camera)
      : anchorWorldPoint(settings.anchor, verse, camera, viewport());
    const anchorScreenAtBuild = worldToScreen(anchorWorld.x, anchorWorld.y, camera);

    // Shift the new page by less than a line so its rows land on the old
    // page's rows, and the crossfade changes the words but not the grid.
    if (settings.snapLines && old.placement) {
      const oldY = pageTransform(old.placement, parallax(), zoomFollow(), scale).y;
      const newY = anchorScreenAtBuild.y - refOffset.y * scale;
      anchorScreenAtBuild.y += lineGridSnap(oldY, newY, LINE_HEIGHT * BASE_FONT_PX * scale);
    }

    page.placement = newPlacement(anchorWorld, anchorScreenAtBuild, refOffset, scale);
    builtAround = centerIndex;
    front = 1 - front;
    place(page);
    page.el.classList.add('front');
    old.el.classList.remove('front');
    lit.clear();
    light();
  }

  // A square anchor tracks its square through a zoom; a viewport anchor
  // stays where it is and only grows.
  function zoomFollow(): number {
    return settings.anchor === 'square' && settings.follow === 'verse' ? 1 : 0;
  }

  // A book-long pan would drift the page off the screen, since the passage
  // does not change until the book does.
  function parallax(): number {
    return settings.follow === 'verse' ? settings.parallax : 0;
  }

  function place(page: Page): void {
    if (!page.placement) return;
    const scale = currentScale();
    const t = pageTransform(page.placement, parallax(), zoomFollow(), scale);
    page.el.style.transform = `translate(${t.x}px, ${t.y}px) scale(${scale})`;
  }

  /** A filled page stops covering the viewport once the zoom has changed its size enough. */
  function rescaledSinceBuild(): boolean {
    const placement = pages[front].placement;
    if (!placement || settings.content !== 'fill') return false;
    const ratio = currentScale() / placement.scaleAtBuild;
    return ratio > RESCALE_REBUILD_RATIO || ratio < 1 / RESCALE_REBUILD_RATIO;
  }

  /** The verse the passage is built around: the centre verse, or the first verse of the dominant unit. */
  function passageVerse(): number {
    if (settings.follow === 'verse') return centerVerseIndex();
    const vp = viewport();
    const topLeft = screenToWorld(0, 0, camera);
    const bottomRight = screenToWorld(vp.width, vp.height, camera);
    const rect = { left: topLeft.x, top: topLeft.y, right: bottomRight.x, bottom: bottomRight.y };
    return dominantUnitStart(verses, rect, settings.follow) ?? builtAround ?? centerVerseIndex();
  }

  function hysteresis(): number {
    return settings.follow === 'verse' ? settings.hysteresis : 0;
  }

  function maybeRegenerate(): void {
    const center = passageVerse();
    if (!shouldRegenerate(builtAround, center, hysteresis()) && !rescaledSinceBuild()) {
      return;
    }
    if (settings.settleMs === 0) {
      build(center);
      return;
    }
    if (settleTimer !== null) window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      settleTimer = null;
      const settled = passageVerse();
      if (shouldRegenerate(builtAround, settled, hysteresis()) || rescaledSinceBuild()) {
        build(settled);
      }
    }, settings.settleMs);
  }

  // The verse indices lit now, so a frame where nothing changed touches no DOM.
  const lit = new Set<number>();

  function light(): void {
    const want = new Set<number>();
    for (const v of options.litVerses()) {
      const i = v ? indexOf.get(verseKey(v)) : undefined;
      if (i !== undefined) want.add(i);
    }
    if (want.size === lit.size && [...want].every((i) => lit.has(i))) return;
    for (const page of pages) {
      page.spans.forEach((span, k) =>
        span.classList.toggle('bgtext-lit', want.has(page.start + k)),
      );
    }
    lit.clear();
    for (const i of want) lit.add(i);
  }

  function update(): void {
    const zoomChanged = camera.zoom !== lastZoom;
    lastZoom = camera.zoom;
    for (const page of pages) {
      if (page.placement) page.placement = advancePlacement(page.placement, camera, zoomChanged);
    }
    maybeRegenerate();
    for (const page of pages) place(page);
    light();
  }

  function setSettings(next: BackgroundTextSettings): void {
    settings = { ...next };
    applyStyle();
    if (settleTimer !== null) {
      window.clearTimeout(settleTimer);
      settleTimer = null;
    }
    build(passageVerse());
    for (const page of pages) place(page);
  }

  applyStyle();
  return { update, setSettings, getSettings: () => ({ ...settings }) };
}
