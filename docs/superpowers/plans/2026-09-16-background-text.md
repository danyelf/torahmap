# Background Hebrew Text Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A flag-gated layer of quiet Hebrew text around the verse nearest the screen center, with a dev panel to switch between viewport-anchored parallax wallpaper and map-anchored text, and to tune size, opacity, and update policy.

**Architecture:** A pure module decides what to show and where its anchor is. A DOM layer with two stacked pages renders the passage, crossfades on regeneration, and is transformed each frame from inside the app's existing `render()` call. A throwaway panel edits the settings and persists them in localStorage. "Behind" mode makes the WebGL clear colour transparent so the layer can sit under the canvas.

**Tech Stack:** TypeScript, Vite, vitest with happy-dom, plain DOM. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-16-background-text-design.md`

## Global Constraints

- Enabled only by `?bgtext=1` in the URL search string. Nothing changes for other users.
- Zoom law: `fontPx = minFont * (maxFont / minFont) ^ (log(zoom / MIN_ZOOM) / log(MAX_ZOOM / MIN_ZOOM))`, defaults 12 and 24.
- Presets: A = viewport anchor, parallax 0.3, window. B = square anchor, parallax 1, center only. C = square anchor, parallax 1, window.
- Hysteresis default 3 verses, settle delay default 150ms, crossfade default 300ms.
- Text colour is a fixed warm grey. Opacity is the control.
- Fonts: Noto Sans Hebrew regular, Frank Ruhl Libre, David Libre, all from Google Fonts.
- No ticket numbers or stage labels in code comments.
- Minimal tests: the pure module only.
- Files are formatted with Prettier (`npm run format`) before each commit; the pre-commit hook also runs typecheck and the whole test suite.

---

### Task 1: The pure module

**Files:**
- Create: `src/backgroundText.ts`
- Test: `src/__tests__/unit/backgroundText.test.ts`

**Interfaces:**
- Consumes: `MIN_ZOOM`, `MAX_ZOOM`, `Camera` from `src/camera.ts`; `screenToWorld` from `src/hitDetection.ts`; `stripNikkud` from `src/search.ts`; `getVerseText`, `VerseTexts` from `src/verseTexts.ts`; `TanakhLayout` from `src/types.ts`.
- Produces: everything the layer and panel use. Exact signatures are in the implementation step.

- [ ] **Step 1: Write the failing tests**

```ts
// src/__tests__/unit/backgroundText.test.ts
import { describe, it, expect } from 'vitest';
import { MIN_ZOOM, MAX_ZOOM } from '../../camera';
import {
  DEFAULT_SETTINGS,
  fontSizeForZoom,
  nearestVerseIndex,
  pageTransform,
  passageAround,
  shouldRegenerate,
  stripMarks,
  windowAround,
} from '../../backgroundText';
import type { TanakhLayout } from '../../types';
import type { VerseTexts } from '../../verseTexts';

const verses: TanakhLayout[] = [
  { book: 'Genesis', chapter: 50, verse: 25, x: 12, y: 0, size: 6 },
  { book: 'Genesis', chapter: 50, verse: 26, x: 6, y: 0, size: 6 },
  { book: 'Exodus', chapter: 1, verse: 1, x: 100, y: 0, size: 6 },
  { book: 'Exodus', chapter: 1, verse: 2, x: 94, y: 0, size: 6 },
];

const texts: VerseTexts = {
  Genesis: { '50': { '25': { he: 'א', en: '' }, '26': { he: 'ב', en: '' } } },
  Exodus: { '1': { '1': { he: 'ג', en: '' }, '2': { he: 'ד', en: '' } } },
};

describe('fontSizeForZoom', () => {
  it('hits the endpoints at the zoom limits and grows on a log scale between', () => {
    expect(fontSizeForZoom(MIN_ZOOM, 12, 24)).toBeCloseTo(12);
    expect(fontSizeForZoom(MAX_ZOOM, 12, 24)).toBeCloseTo(24);
    // Zoom 1 is halfway across the log range, so the font is 12 * sqrt(2).
    expect(fontSizeForZoom(1, 12, 24)).toBeCloseTo(12 * Math.SQRT2);
  });
});

describe('nearestVerseIndex', () => {
  it('picks the square whose center is closest to the world point', () => {
    expect(nearestVerseIndex(verses, 101, 4)).toBe(2);
    expect(nearestVerseIndex(verses, 8, 1)).toBe(1);
  });
});

describe('windowAround', () => {
  it('clamps at both ends of the corpus', () => {
    expect(windowAround(0, 4, 2)).toEqual({ start: 0, end: 2 });
    expect(windowAround(3, 4, 2)).toEqual({ start: 1, end: 3 });
  });
});

describe('passageAround', () => {
  it('runs across a book boundary in canonical order', () => {
    const settings = { ...DEFAULT_SETTINGS, content: 'window' as const, neighbours: 1, marks: 'all' as const };
    expect(passageAround(verses, texts, 2, settings)).toEqual({ before: 'ב', center: 'ג', after: 'ד' });
  });

  it('shows only the center verse when content is center', () => {
    const settings = { ...DEFAULT_SETTINGS, content: 'center' as const, marks: 'all' as const };
    expect(passageAround(verses, texts, 1, settings)).toEqual({ before: '', center: 'ב', after: '' });
  });
});

describe('shouldRegenerate', () => {
  it('always builds the first time, then only past the hysteresis', () => {
    expect(shouldRegenerate(null, 5, 3)).toBe(true);
    expect(shouldRegenerate(5, 8, 3)).toBe(false);
    expect(shouldRegenerate(5, 9, 3)).toBe(true);
  });
});

describe('stripMarks', () => {
  // bet + sheva + etnahta + resh: U+05D1 U+05B0 U+0591 U+05E8
  const word = 'בְ֑ר';
  it('keeps everything, drops trop, or drops trop and nikkud', () => {
    expect(stripMarks(word, 'all')).toBe(word);
    expect(stripMarks(word, 'no-trop')).toBe('בְר');
    expect(stripMarks(word, 'letters')).toBe('בר');
  });
});

describe('pageTransform', () => {
  const placement = {
    anchorWorld: { x: 100, y: 50 },
    anchorScreenAtBuild: { x: 300, y: 200 },
    refOffset: { x: 40, y: 10 },
  };

  it('keeps the reference point on the anchor when parallax is 1', () => {
    // Camera moved: the anchor is now at screen (350, 260).
    const camera = { x: 250, y: 210, zoom: 1 };
    expect(pageTransform(placement, camera, 1, 1)).toEqual({ x: 310, y: 250 });
  });

  it('does not move at all when parallax is 0', () => {
    const camera = { x: 250, y: 210, zoom: 1 };
    expect(pageTransform(placement, camera, 0, 1)).toEqual({ x: 260, y: 190 });
  });

  it('scales the reference offset with the page scale', () => {
    const camera = { x: 200, y: 150, zoom: 1 };
    expect(pageTransform(placement, camera, 1, 2)).toEqual({ x: 220, y: 180 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/__tests__/unit/backgroundText.test.ts`
Expected: FAIL, cannot resolve `../../backgroundText`.

- [ ] **Step 3: Write the module**

```ts
// src/backgroundText.ts
// Background Hebrew text: the pure part. Which verses to show, how large the
// text is at a given zoom, and where the layer's anchor point is. Nothing here
// touches the DOM; the layer module does that.

import { MIN_ZOOM, MAX_ZOOM, type Camera } from './camera.ts';
import { screenToWorld } from './hitDetection.ts';
import { stripNikkud } from './search.ts';
import { getVerseText, type VerseTexts } from './verseTexts.ts';
import type { TanakhLayout } from './types.ts';

export type Layer = 'behind' | 'above';
export type Anchor = 'viewport' | 'square';
export type Content = 'center' | 'window';
export type Marks = 'all' | 'no-trop' | 'letters';
export type Font = 'noto' | 'frank' | 'david';

export interface BackgroundTextSettings {
  /** Under the canvas (squares occlude the text) or over it at low opacity. */
  layer: Layer;
  /** How much of the map's screen movement the text follows: 0 is fixed to the glass, 1 is glued to the map. */
  parallax: number;
  /** What the passage is pinned to: the point under the screen center, or the center verse's own square. */
  anchor: Anchor;
  /** The center verse alone, or a window of neighbours around it. */
  content: Content;
  /** Verses on each side of the center verse when content is 'window'. */
  neighbours: number;
  /** Font size in CSS pixels at MIN_ZOOM and at MAX_ZOOM. */
  minFont: number;
  maxFont: number;
  opacity: number;
  font: Font;
  marks: Marks;
  /** Keep the current passage until the center verse is more than this many verses away. */
  hysteresis: number;
  /** Regenerate only after the camera has been still this long. 0 means immediately. */
  settleMs: number;
  crossfadeMs: number;
}

export const DEFAULT_SETTINGS: BackgroundTextSettings = {
  layer: 'above',
  parallax: 0.3,
  anchor: 'viewport',
  content: 'window',
  neighbours: 6,
  minFont: 12,
  maxFont: 24,
  opacity: 0.25,
  font: 'frank',
  marks: 'no-trop',
  hysteresis: 3,
  settleMs: 150,
  crossfadeMs: 300,
};

export const PRESETS = {
  A: { anchor: 'viewport', parallax: 0.3, content: 'window' },
  B: { anchor: 'square', parallax: 1, content: 'center' },
  C: { anchor: 'square', parallax: 1, content: 'window' },
} as const satisfies Record<string, Partial<BackgroundTextSettings>>;

export const FONT_FAMILIES: Record<Font, string> = {
  noto: '"Noto Sans Hebrew", system-ui, sans-serif',
  frank: '"Frank Ruhl Libre", serif',
  david: '"David Libre", serif',
};

/**
 * Font size for a zoom level, interpolated on a log scale so that equal wheel
 * steps give equal font steps. Clamped to the zoom limits.
 */
export function fontSizeForZoom(zoom: number, minFont: number, maxFont: number): number {
  const t = Math.log(zoom / MIN_ZOOM) / Math.log(MAX_ZOOM / MIN_ZOOM);
  const clamped = Math.max(0, Math.min(1, t));
  return minFont * Math.pow(maxFont / minFont, clamped);
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  camera: Camera,
): { x: number; y: number } {
  return { x: (worldX + camera.x) * camera.zoom, y: (worldY + camera.y) * camera.zoom };
}

/** Index of the verse whose square center is nearest the world point. Linear scan. */
export function nearestVerseIndex(verses: TanakhLayout[], worldX: number, worldY: number): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < verses.length; i++) {
    const v = verses[i];
    const dx = v.x + v.size / 2 - worldX;
    const dy = v.y + v.size / 2 - worldY;
    const d = dx * dx + dy * dy;
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}

/** Inclusive index range of `neighbours` verses on each side of `center`, clamped to the corpus. */
export function windowAround(
  center: number,
  count: number,
  neighbours: number,
): { start: number; end: number } {
  return {
    start: Math.max(0, center - neighbours),
    end: Math.min(count - 1, center + neighbours),
  };
}

export function shouldRegenerate(
  builtAround: number | null,
  center: number,
  hysteresis: number,
): boolean {
  if (builtAround === null) return true;
  return Math.abs(center - builtAround) > hysteresis;
}

// Cantillation accents occupy U+0591 to U+05AF; the vowel points follow them.
const TROP_START = 0x0591;
const TROP_END = 0x05af;

export function stripMarks(text: string, marks: Marks): string {
  if (marks === 'all') return text;
  if (marks === 'letters') return stripNikkud(text);
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code < TROP_START || code > TROP_END) out += ch;
  }
  return out;
}

/** The passage split in three so the layer can wrap the center verse in its own element. */
export interface Passage {
  before: string;
  center: string;
  after: string;
}

export function passageAround(
  verses: TanakhLayout[],
  texts: VerseTexts,
  centerIndex: number,
  settings: Pick<BackgroundTextSettings, 'content' | 'neighbours' | 'marks'>,
): Passage {
  const { start, end } =
    settings.content === 'center'
      ? { start: centerIndex, end: centerIndex }
      : windowAround(centerIndex, verses.length, settings.neighbours);

  const hebrew = (i: number): string => {
    const v = verses[i];
    const text = getVerseText(texts, v.book, v.chapter, v.verse);
    return text ? stripMarks(text.he, settings.marks) : '';
  };
  const join = (from: number, to: number): string => {
    const parts: string[] = [];
    for (let i = from; i <= to; i++) parts.push(hebrew(i));
    return parts.join(' ');
  };

  return {
    before: start < centerIndex ? join(start, centerIndex - 1) : '',
    center: hebrew(centerIndex),
    after: end > centerIndex ? join(centerIndex + 1, end) : '',
  };
}

/**
 * The world point a passage is pinned to. For the square anchor it is the
 * top-right corner of the center verse's square, where the first word of a
 * right-to-left paragraph naturally starts. For the viewport anchor it is
 * whatever world point lies under the screen center right now.
 */
export function anchorWorldPoint(
  anchor: Anchor,
  verse: TanakhLayout,
  camera: Camera,
  viewport: { width: number; height: number },
): { x: number; y: number } {
  if (anchor === 'square') return { x: verse.x + verse.size, y: verse.y };
  return screenToWorld(viewport.width / 2, viewport.height / 2, camera);
}

/**
 * Where a built page is pinned. `refOffset` is the reference point (the
 * top-right of the center verse's first line) measured inside the page at its
 * base font size, before any scale is applied.
 */
export interface PagePlacement {
  anchorWorld: { x: number; y: number };
  anchorScreenAtBuild: { x: number; y: number };
  refOffset: { x: number; y: number };
}

/**
 * Translation for a page so that its reference point lands on the anchor,
 * with the anchor's screen movement since build time reduced by the parallax
 * ratio. The page is scaled about its top-left corner, so the reference offset
 * scales too.
 */
export function pageTransform(
  placement: PagePlacement,
  camera: Camera,
  parallax: number,
  scale: number,
): { x: number; y: number } {
  const now = worldToScreen(placement.anchorWorld.x, placement.anchorWorld.y, camera);
  const at = placement.anchorScreenAtBuild;
  const ax = at.x + parallax * (now.x - at.x);
  const ay = at.y + parallax * (now.y - at.y);
  return { x: ax - placement.refOffset.x * scale, y: ay - placement.refOffset.y * scale };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/__tests__/unit/backgroundText.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/backgroundText.ts src/__tests__/unit/backgroundText.test.ts
git commit -m "Decide what background text to show, how big, and where it is pinned

Refs #142

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Transparent clear, fonts, styles, and the DOM layer

**Files:**
- Modify: `src/rendering.ts` (RenderState and the clear in `render`)
- Modify: `index.html` (Google Fonts link)
- Modify: `src/styles/main.css` (layer and page styles)
- Create: `src/backgroundTextLayer.ts`

**Interfaces:**
- Consumes: everything exported by `src/backgroundText.ts` in Task 1.
- Produces: `createBackgroundTextLayer(options): BackgroundTextLayer` with `update()`, `setSettings(next)`, `getSettings()`. `RenderState.transparentBackground?: boolean`.

- [ ] **Step 1: Let the WebGL pass clear to transparent**

In `src/rendering.ts`, add to `RenderState`:

```ts
  /** Clear to transparent so a page layer under the canvas shows through. */
  transparentBackground?: boolean;
```

In `render`, replace the fixed clear colour:

```ts
  if (state.transparentBackground) {
    gl.clearColor(0, 0, 0, 0);
  } else {
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
  }
```

- [ ] **Step 2: Load the fonts**

In `index.html`, replace the Google Fonts `href` with:

```
https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;700&family=Frank+Ruhl+Libre&family=David+Libre&display=swap
```

- [ ] **Step 3: Add the styles**

Append to `src/styles/main.css`:

```css
/* Background Hebrew text (prototype, behind ?bgtext=1) */
#bgtext {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  direction: rtl;
  color: #b8ad98;
}
#bgtext[data-layer='behind'] {
  z-index: -1;
}
#bgtext[data-layer='above'] {
  z-index: 1;
}
.bgtext-page {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  will-change: transform;
  line-height: 1.6;
  opacity: 0;
  transition: opacity var(--bgtext-fade, 300ms) linear;
}
.bgtext-page.front {
  opacity: var(--bgtext-opacity, 0.25);
}
```

- [ ] **Step 4: Write the layer**

```ts
// src/backgroundTextLayer.ts
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
const PAGE_WIDTH_EM = 30;

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
    el.style.width = `${PAGE_WIDTH_EM * BASE_FONT_PX}px`;
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
  }

  function viewport(): { width: number; height: number } {
    return { width: window.innerWidth, height: window.innerHeight };
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

    const center = document.createElement('span');
    center.className = 'bgtext-center';
    center.textContent = passage.center;
    page.el.replaceChildren(
      document.createTextNode(passage.before ? `${passage.before} ` : ''),
      center,
      document.createTextNode(passage.after ? ` ${passage.after}` : ''),
    );

    // Measure the reference point unscaled: the top-right of the center
    // verse's first line box, relative to the page's own top-left.
    page.el.style.transform = 'none';
    const pageRect = page.el.getBoundingClientRect();
    const firstLine = center.getClientRects()[0] ?? pageRect;
    const refOffset = { x: firstLine.right - pageRect.left, y: firstLine.top - pageRect.top };

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
```

- [ ] **Step 5: Typecheck and run the suite**

Run: `npm run typecheck && npx vitest run`
Expected: no type errors; all tests pass. Nothing calls the layer yet, so there is nothing to see in the browser.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/rendering.ts index.html src/styles/main.css src/backgroundTextLayer.ts
git commit -m "Add a DOM layer that pins a passage of Hebrew to the map

Refs #142

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The dev panel and wiring into the app

**Files:**
- Create: `src/backgroundTextPanel.ts`
- Modify: `src/styles/main.css` (panel styles)
- Modify: `src/main.ts` (create the layer behind the flag; call `update()` from `render()`)

**Interfaces:**
- Consumes: `createBackgroundTextLayer` and `BackgroundTextLayer` from Task 2; `DEFAULT_SETTINGS`, `PRESETS`, `BackgroundTextSettings` from Task 1.
- Produces: `loadSettings(): BackgroundTextSettings`, `createBackgroundTextPanel(initial, onChange): HTMLDivElement`.

- [ ] **Step 1: Write the panel**

```ts
// src/backgroundTextPanel.ts
// Throwaway dev panel for the background text prototype. Edits every setting
// live, keeps them in localStorage across reloads, and copies them as JSON so a
// combination that works can be pasted into a conversation.

import { DEFAULT_SETTINGS, PRESETS, type BackgroundTextSettings } from './backgroundText.ts';

const STORAGE_KEY = 'bgtext-settings';

export function loadSettings(): BackgroundTextSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // Private mode or blocked storage: fall through to the defaults.
  }
  return { ...DEFAULT_SETTINGS };
}

type Key = keyof BackgroundTextSettings;

export function createBackgroundTextPanel(
  initial: BackgroundTextSettings,
  onChange: (next: BackgroundTextSettings) => void,
): HTMLDivElement {
  let settings: BackgroundTextSettings = { ...initial };
  const panel = document.createElement('div');
  panel.id = 'bgtext-panel';
  const inputs = new Map<Key, HTMLInputElement | HTMLSelectElement>();
  const outputs = new Map<Key, HTMLOutputElement>();

  function commit(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage unavailable; the panel still works for this page load.
    }
    onChange({ ...settings });
  }

  function set(key: Key, value: string | number): void {
    settings = { ...settings, [key]: value } as BackgroundTextSettings;
    commit();
  }

  function refreshInputs(): void {
    for (const [key, el] of inputs) el.value = String(settings[key]);
    for (const [key, out] of outputs) out.textContent = String(settings[key]);
  }

  function row(label: string, control: HTMLElement): void {
    const r = document.createElement('label');
    const text = document.createElement('span');
    text.textContent = label;
    r.append(text, control);
    panel.appendChild(r);
  }

  function select(key: Key, choices: string[]): HTMLSelectElement {
    const s = document.createElement('select');
    for (const c of choices) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      s.appendChild(opt);
    }
    s.value = String(settings[key]);
    s.addEventListener('change', () => set(key, s.value));
    inputs.set(key, s);
    return s;
  }

  function range(key: Key, min: number, max: number, step: number): HTMLElement {
    const i = document.createElement('input');
    i.type = 'range';
    i.min = String(min);
    i.max = String(max);
    i.step = String(step);
    i.value = String(settings[key]);
    const out = document.createElement('output');
    out.textContent = i.value;
    i.addEventListener('input', () => {
      out.textContent = i.value;
      set(key, Number(i.value));
    });
    inputs.set(key, i);
    outputs.set(key, out);
    const wrap = document.createElement('span');
    wrap.className = 'bgtext-range';
    wrap.append(i, out);
    return wrap;
  }

  const presets = document.createElement('div');
  presets.className = 'bgtext-presets';
  for (const name of Object.keys(PRESETS) as (keyof typeof PRESETS)[]) {
    const b = document.createElement('button');
    b.textContent = name;
    b.addEventListener('click', () => {
      settings = { ...settings, ...PRESETS[name] };
      refreshInputs();
      commit();
    });
    presets.appendChild(b);
  }
  const copy = document.createElement('button');
  copy.textContent = 'copy';
  copy.addEventListener('click', () => {
    void navigator.clipboard.writeText(JSON.stringify(settings, null, 2));
  });
  presets.appendChild(copy);
  panel.appendChild(presets);

  row('layer', select('layer', ['behind', 'above']));
  row('anchor', select('anchor', ['viewport', 'square']));
  row('parallax', range('parallax', 0, 1, 0.05));
  row('content', select('content', ['center', 'window']));
  row('neighbours', range('neighbours', 1, 20, 1));
  row('min font', range('minFont', 6, 40, 1));
  row('max font', range('maxFont', 6, 80, 1));
  row('opacity', range('opacity', 0, 1, 0.05));
  row('font', select('font', ['noto', 'frank', 'david']));
  row('marks', select('marks', ['all', 'no-trop', 'letters']));
  row('hysteresis', range('hysteresis', 0, 30, 1));
  row('settle ms', range('settleMs', 0, 1000, 50));
  row('crossfade ms', range('crossfadeMs', 0, 2000, 50));

  return panel;
}
```

- [ ] **Step 2: Style the panel**

Append to `src/styles/main.css`:

```css
#bgtext-panel {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 20;
  display: grid;
  gap: 4px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.75);
  color: #ddd;
  font: 11px system-ui, sans-serif;
  border-radius: 4px;
}
#bgtext-panel label {
  display: grid;
  grid-template-columns: 80px 1fr;
  align-items: center;
  gap: 6px;
}
#bgtext-panel .bgtext-range {
  display: flex;
  align-items: center;
  gap: 4px;
}
#bgtext-panel input[type='range'] {
  width: 110px;
}
#bgtext-panel output {
  min-width: 32px;
  text-align: right;
}
#bgtext-panel .bgtext-presets {
  display: flex;
  gap: 4px;
}
```

- [ ] **Step 3: Wire it into `src/main.ts`**

Add the imports near the other module imports:

```ts
import { createBackgroundTextLayer, type BackgroundTextLayer } from './backgroundTextLayer.ts';
import { createBackgroundTextPanel, loadSettings } from './backgroundTextPanel.ts';
```

Just before the `function render(): void {` definition (around line 245), declare the layer so `render` can see it:

```ts
  // Background Hebrew text prototype; created below only when ?bgtext=1
  let backgroundText: BackgroundTextLayer | null = null;
```

Inside `render()`, after the `renderFrame(...)` call:

```ts
    backgroundText?.update();
```

After the book labels are created and first positioned (after the `updateLabelPositions(window.bookLabels, ...)` line around 292):

```ts
  if (new URLSearchParams(window.location.search).get('bgtext') === '1') {
    const settings = loadSettings();
    backgroundText = createBackgroundTextLayer({
      verses,
      texts: verseTexts,
      camera,
      settings,
      container: document.body,
    });
    renderState.transparentBackground = settings.layer === 'behind';
    document.body.appendChild(
      createBackgroundTextPanel(settings, (next) => {
        backgroundText?.setSettings(next);
        renderState.transparentBackground = next.layer === 'behind';
        render();
      }),
    );
    render();
  }
```

The resize handler already calls `render()`, and story-mode scrolling goes through `render()` too, so no further hooks are needed.

- [ ] **Step 4: Typecheck, test, and look at it**

Run: `npm run typecheck && npx vitest run`
Expected: clean.

Start a dev server as a background task, read its output for the port, and open `http://localhost:<port>/?bgtext=1`. Confirm in the browser:

1. The panel appears top-left and text appears around the screen center.
2. Preset A: drag the map; the text slides at a fraction of the map's speed. Zoom in with the wheel; the text grows slowly while the squares grow fast.
3. Preset B: zoom into Genesis 1:1 (top right). The first verse's text sits at its square and moves with it exactly.
4. Preset C: same, but the neighbouring verses flow from it.
5. Layer behind: squares cover the text; layer above: text tints the squares.
6. Reload: settings persist.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/backgroundTextPanel.ts src/styles/main.css src/main.ts
git commit -m "Put the background text behind a flag with a panel to tune it

Refs #142

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Screenshots and the PR

**Files:**
- None in the repo. Screenshots go to the scratchpad directory and into the PR.

- [ ] **Step 1: Capture the presets**

With the dev server running, use the browser tools to open `?bgtext=1`, select each preset in turn, and take a screenshot at zoom 1 and zoomed into Genesis 1:1, for both layer positions. Read every PNG before describing it. Note anything that is clearly wrong (text off screen, no crossfade, shear during pan) and fix it before the PR.

- [ ] **Step 2: Push and open a draft PR**

```bash
git push -u origin "$(git branch --show-current)"
gh pr create --base main --draft --title "Prototype: background Hebrew text with a tuning panel" --body "$(cat <<'EOF'
Refs #142

A flag-gated prototype: open the app with `?bgtext=1` to get a layer of quiet Hebrew text around the verse nearest the screen center, and a panel to tune it.

The panel offers three presets: A is a parallax wallpaper on the glass, B pins the center verse's text to its own square, C pins a passage there and lets the neighbours flow from it. Layer position, font size at both ends of the zoom range, opacity, font, marks, and the regeneration policy are all live.

Design: docs/superpowers/specs/2026-09-16-background-text-design.md

Screenshots follow in a comment.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Then attach the screenshots in a PR comment and hand over for Danyel to judge the feel.
