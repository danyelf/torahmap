# Palette Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make six palette candidates runnable in the live app via a `?theme=<id>` URL param, without changing the default visible behavior. Open the door (but do not build) a user-facing picker.

**Architecture:** Per the spec at `docs/plans/2026-05-13-palette-registry-design.md` (Architecture B). One `src/themes.ts` module owns the `CoreTheme` interface, the theme records (added incrementally; declared as `Partial<Record<ThemeId, CoreTheme>>`), the resolution logic (URL param → `localStorage` → default), and a `ThemedTable<T>` + `pick<T>` helper that data overlays use for their per-theme contributions. Existing color-bearing constants (`HIGHLIGHT_CONSTANTS`, `SEARCH_COLORS`, plus the Talmud-side `MISHNAH_BASE_COLOR` / `GEMARA_BASE_COLOR` / `SEDER_BACKGROUND_COLORS`) keep their import surface but source their values from `currentTheme`. Data-driven overlays (`commentary` heatmap, `trop`, `text-dating`) and the Talmud structural-color surface each declare one `ThemedTable<T>` next to their render code; `pick<T>` resolves it with refined-grey as the dark canonical fallback and a hand-picked light fallback. The search-overlay dim formula applies `currentTheme.dust.tint` so dimmed non-matches recede in any palette. CSS chrome moves to custom properties on `:root`. Theme swap requires page reload.

**Tech Stack:** TypeScript, Vite, Vitest (`happy-dom` env), WebGL 2. No new runtime deps.

**In scope:** the Tanakh map AND the Talmud map. The Talmud surface (`src/talmud/*`) has parallel structural-color constants that follow the same wiring shape as the Tanakh side, so it's near-zero extra cost to bring along.

**Out of scope for this plan:**

- The user-facing picker UI (blocked on ≥2 themes clearing the promotion gate).
- Mid-session theme swap (page reload only).
- Per-theme full tunings for every overlay (each ships with polarity fallback; hand-tuning per theme is a follow-up issue per the slot map).
- A11y palette (WCAG / CBF-safe) — separate spec.
- **Inline DOM chrome colors in overlay files.** Specifically: `src/overlays/search.ts:146,187,199,205` (`#FF9800`, `#888`), `src/overlays/trop.ts:199,212` (`#666`, `#888`), `src/overlays/haftarah.ts:358,403,406,409,412` (`#aaa`, `#888`, `#666`). These are hardcoded `style="color: …"` strings on tooltip/hint DOM elements. They fight a light theme but are out of scope here — file a follow-up issue.
- **Haftarah hue generator's S/L parameters** (`hslToRgb({h, s: 0.8, l: 0.55})` in `src/overlays/haftarah.ts:67-69`). Audited and left as-is; theme-aware S/L is a future "thematic haftarah" pass.
- **Talmud route verification in `palette:verify`** — the script targets the main route; Talmud has its own entry point (`main-talmud.ts`) and would need its own verify script.

---

## File Structure

**Create:**

- `src/themes.ts` — `Color`, `ThemeId`, `CoreTheme` types; `THEMES` record (six themes); `resolveThemeId()`; `currentTheme` export; `applyChromeVars()` helper.
- `src/__tests__/unit/themes.test.ts` — covers `resolveThemeId` precedence and `applyChromeVars` side effects.
- `scripts/palette-verify.mjs` — runs `probe.mjs` against each theme id, saves screenshots to `docs/plans/data/palettes/<id>/`.

**Modify:**

- `src/constants.ts` — color-bearing fields read from `currentTheme`; non-color constants stay as literals.
- `src/utils/color.ts` — `SEARCH_COLORS` reads from `currentTheme.searchHues`; `heatmapColor()` reads from `HEATMAP_BY_THEME` table with polarity fallback.
- `src/rendering.ts` — `gl.clearColor` and dust tint use `currentTheme`.
- `src/itemColoring.ts` — dust ramp respects `currentTheme.dust.tint` when present.
- `src/overlays/trop.ts` — gradient stops + `RARE_MATCH_COLOR` read from per-theme tables.
- `src/overlays/text-dating.ts` — `ERAS[].baseColor` reads from per-theme table.
- `src/overlays/haftarah.ts` — verify desaturation is palette-agnostic; no change expected, document the verification.
- `src/overlays/verse-length.ts` — verify PLASMA palette is palette-agnostic by design (perceptually uniform); no change expected, document.
- `src/overlays/search.ts` — apply `currentTheme.dust.tint` to the dim-non-match formula at line 623.
- `src/overlays/trop.ts` (additionally) — empty-state literals at lines 80 & 86 move into the per-theme `TropPalette`.
- `src/talmud/constants.ts` — `MISHNAH_BASE_COLOR`, `GEMARA_BASE_COLOR`, `SEDER_BACKGROUND_COLORS`, `SEDER_BACKGROUND_OPACITY` source from `currentTheme.talmud` with polarity fallback.
- `src/talmud/overlays/segment-length.ts` — `PALE` / `DARK` source from `currentTheme.talmud.segmentLength` with polarity fallback.
- `src/main.ts` — call `applyChromeVars(currentTheme)` once at boot.
- `src/styles/main.css` — body bg uses `var(--bg)`.
- `src/styles/hebrewKeyboard.css`, `src/styles/help.css`, `src/styles/overlays/*` — migrate hardcoded chrome colors (background-color, text color) to CSS custom properties where the theme owns them.
- `package.json` — add `"palette:verify": "node scripts/palette-verify.mjs"`.

**Why a single `themes.ts` not a folder:** Six themes × ~25 lines each is ~150 lines plus ~50 for the resolver and types. One file fits in working memory and produces no module-graph fan-out. Promote to a folder later if it grows.

---

## Task 1: Define `CoreTheme` types and the `refined-grey` record

Set up the module shape with only the shipped theme. No behavior change; this task is pure new code.

**Files:**
- Create: `src/themes.ts`
- Test: `src/__tests__/unit/themes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/unit/themes.test.ts
import { describe, it, expect } from 'vitest';
import { THEMES, type ThemeId } from '../../themes.ts';
import { HIGHLIGHT_CONSTANTS } from '../../constants.ts';

describe('themes registry', () => {
  it('refined-grey theme matches the shipped HIGHLIGHT_CONSTANTS values', () => {
    const t = THEMES['refined-grey'];
    expect(t.id).toBe('refined-grey');
    expect(t.polarity).toBe('dark');
    expect(t.bg).toEqual(HIGHLIGHT_CONSTANTS.CANVAS_BG_COLOR);
    expect(t.dust.min).toBe(HIGHLIGHT_CONSTANTS.MIN_BRIGHTNESS);
    expect(t.dust.max).toBe(
      HIGHLIGHT_CONSTANTS.MIN_BRIGHTNESS + HIGHLIGHT_CONSTANTS.BRIGHTNESS_RANGE
    );
    expect(t.dim).toBe(HIGHLIGHT_CONSTANTS.DIM_BRIGHTNESS);
    expect(t.outlines.pin).toEqual(HIGHLIGHT_CONSTANTS.PINNED_OUTLINE_COLOR);
    expect(t.outlines.hover).toEqual(HIGHLIGHT_CONSTANTS.HOVER_OUTLINE_COLOR);
  });

  it('every entry in THEMES round-trips by id', () => {
    for (const id of Object.keys(THEMES) as ThemeId[]) {
      expect(THEMES[id]?.id).toBe(id);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/unit/themes.test.ts`
Expected: FAIL with "Cannot find module '../../themes'".

- [ ] **Step 3: Create the module with types and the refined-grey record**

```ts
// src/themes.ts
import type { Color } from './overlays/types.ts';

export type ThemeId =
  | 'refined-grey'
  | 'newsprint'
  | 'plum'
  | 'oxblood'
  | 'manuscript'
  | 'okabe';

/**
 * Structural-color overrides for the Talmud surface. Optional — themes that
 * don't define it fall back to a polarity-keyed default (see Task 12).
 */
export interface TalmudTheme {
  mishnahBase: Color;
  gemaraBase: Color;
  sederBackgrounds: Record<string, Color>;       // keyed by SEDER_ORDER strings
  sederBackgroundOpacity: number;
  segmentLength: { pale: Color; dark: Color };
}

export interface CoreTheme {
  id: ThemeId;
  name: string;
  polarity: 'dark' | 'light';
  bg: Color;
  cssBg: string;
  dust: { min: number; max: number; tint?: Color };
  dim: number;
  searchHues: Color[];
  outlines: {
    default: Color;
    hover: Color;
    pin: Color;
    hoverWhilePinned: Color;
  };
  chrome: {
    fg: string;
    sidebarBg: string;
    sidebarFg: string;
    link: string;
  };
  talmud?: TalmudTheme;                          // optional; polarity fallback handles missing
}

/**
 * Generic per-overlay theme contribution table. Used by data overlays to
 * declare per-theme color sets with a polarity fallback.
 *
 * Resolution order at runtime:
 *   1. `byTheme[currentTheme.id]` — explicit per-theme tuning
 *   2. light polarity → `lightFallback`
 *   3. dark polarity → `byTheme['refined-grey']` (always defined)
 *
 * Refined-grey is the canonical dark fallback. If a future palette ever
 * displaces it, update `pick()` rather than touching every overlay.
 */
export interface ThemedTable<T> {
  byTheme: Partial<Record<ThemeId, T>>;
  lightFallback: T;
}

export const THEMES: Partial<Record<ThemeId, CoreTheme>> = {
  'refined-grey': {
    id: 'refined-grey',
    name: 'Refined Grey',
    polarity: 'dark',
    bg: [0.102, 0.102, 0.102],
    cssBg: '#1a1a1a',
    dust: { min: 0.50, max: 0.92 },
    dim: 0.30,
    searchHues: [
      [0.00, 0.85, 1.00],
      [1.00, 0.55, 0.00],
      [0.20, 1.00, 0.30],
      [1.00, 0.15, 0.85],
      [1.00, 0.95, 0.05],
    ],
    outlines: {
      default: [0.6, 0.6, 0.6],
      hover:   [1.0, 1.0, 1.0],
      pin:     [0.2, 0.9, 1.0],
      hoverWhilePinned: [1.0, 0.8, 0.2],
    },
    chrome: {
      fg: '#fff',
      sidebarBg: 'rgba(0, 0, 0, 0.85)',
      sidebarFg: '#aaa',
      link: '#4ec3ff',
    },
  },
  // newsprint, plum, oxblood, manuscript, okabe added in Tasks 7–11.
};
```

Note: `THEMES` is declared `Partial<Record<ThemeId, CoreTheme>>` so the type stays honest while incomplete. Tasks 7–11 each add one entry. The resolver in Task 2 always returns the refined-grey record (which is present from this task onward), so `currentTheme` is never undefined regardless of how many themes are wired.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/unit/themes.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Run the typechecker**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/themes.ts src/__tests__/unit/themes.test.ts
git commit -m "feat(themes): introduce CoreTheme registry with refined-grey"
```

---

## Task 2: Add theme resolution (`?theme=` → localStorage → default)

**Files:**
- Modify: `src/themes.ts`
- Test: `src/__tests__/unit/themes.test.ts`

- [ ] **Step 1: Add failing tests for resolveThemeId**

Append to `src/__tests__/unit/themes.test.ts`:

```ts
import { resolveThemeId } from '../../themes.ts';

describe('resolveThemeId', () => {
  const origLocation = window.location;
  const origStorage = { ...localStorage };

  function mockLocation(search: string) {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...origLocation, search },
    });
  }

  beforeEach(() => { localStorage.clear(); });
  afterEach(() => {
    Object.defineProperty(window, 'location', { writable: true, value: origLocation });
    localStorage.clear();
    for (const [k, v] of Object.entries(origStorage)) localStorage.setItem(k, v as string);
  });

  it('uses URL param when present and valid', () => {
    mockLocation('?theme=newsprint');
    expect(resolveThemeId()).toBe('newsprint');
  });

  it('falls back to localStorage when URL absent', () => {
    mockLocation('');
    localStorage.setItem('torahmap.theme', 'plum');
    expect(resolveThemeId()).toBe('plum');
  });

  it('falls back to refined-grey when neither present', () => {
    mockLocation('');
    expect(resolveThemeId()).toBe('refined-grey');
  });

  it('falls back to refined-grey on invalid id', () => {
    mockLocation('?theme=phosphor');
    expect(resolveThemeId()).toBe('refined-grey');
  });

  it('URL precedence over localStorage', () => {
    mockLocation('?theme=oxblood');
    localStorage.setItem('torahmap.theme', 'newsprint');
    expect(resolveThemeId()).toBe('oxblood');
  });
});
```

Also add `import { beforeEach, afterEach } from 'vitest';` to the file imports.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/__tests__/unit/themes.test.ts`
Expected: FAIL with "resolveThemeId is not exported".

- [ ] **Step 3: Implement resolveThemeId, currentTheme, and the `pick<T>` helper**

Append to `src/themes.ts`:

```ts
const VALID_IDS = new Set<ThemeId>([
  'refined-grey', 'newsprint', 'plum', 'oxblood', 'manuscript', 'okabe',
]);

function isThemeId(s: string | null | undefined): s is ThemeId {
  return !!s && VALID_IDS.has(s as ThemeId);
}

export function resolveThemeId(): ThemeId {
  const fromUrl = new URLSearchParams(globalThis.location?.search ?? '').get('theme');
  if (isThemeId(fromUrl)) return fromUrl;
  const fromStorage = globalThis.localStorage?.getItem('torahmap.theme') ?? null;
  if (isThemeId(fromStorage)) return fromStorage;
  return 'refined-grey';
}

// Single resolution at module load. A theme swap is a page reload.
// THEMES['refined-grey'] is always defined (set in Task 1), so the non-null
// assertion is safe and reflects the actual invariant.
export const currentTheme: CoreTheme =
  THEMES[resolveThemeId()] ?? THEMES['refined-grey']!;

/**
 * Look up an overlay's per-theme value, with polarity fallback. See
 * `ThemedTable<T>` for the resolution order. Read once at the call site —
 * `currentTheme` is fixed for the page's lifetime.
 */
export function pick<T>(t: ThemedTable<T>): T {
  return t.byTheme[currentTheme.id]
      ?? (currentTheme.polarity === 'light' ? t.lightFallback : t.byTheme['refined-grey']!);
}
```

If `?theme=newsprint` is requested before Task 7 lands (no entry in `THEMES`), the resolver returns refined-grey and the URL param appears to do nothing. That's intentional — partial wiring during the plan should never break the app.

- [ ] **Step 4: Run all theme tests**

Run: `npx vitest run src/__tests__/unit/themes.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/themes.ts src/__tests__/unit/themes.test.ts
git commit -m "feat(themes): add resolveThemeId and currentTheme"
```

---

## Task 3: Wire `HIGHLIGHT_CONSTANTS` color fields to `currentTheme`

Refactor — no behavior change. Existing tests must stay green.

**Files:**
- Modify: `src/constants.ts`

- [ ] **Step 1: Run existing tests once to establish baseline**

Run: `npm test`
Expected: PASS. Record the pass count for comparison.

- [ ] **Step 2: Replace color-bearing literals in `src/constants.ts` with theme reads**

Modify `src/constants.ts`:

```ts
// src/constants.ts
import type { Color } from './overlays/types.ts';
import { currentTheme } from './themes.ts';

export const HIGHLIGHT_CONSTANTS = {
  // Non-color constants — palette-agnostic, stay as literals
  FUZZY_RADIUS: 10,
  BLEED_PIXELS: 3,
  OUTLINE_THICKNESS: 2,
  DIM_FACTOR: 0.3,
  BRIGHTNESS_FACTOR: 1.5,
  DESATURATE_FACTOR: 0.2,

  // Color-bearing fields sourced from currentTheme
  MIN_BRIGHTNESS: currentTheme.dust.min,
  BRIGHTNESS_RANGE: currentTheme.dust.max - currentTheme.dust.min,
  CANVAS_BG_COLOR: currentTheme.bg,
  DIM_BRIGHTNESS: currentTheme.dim,
  OUTLINE_COLOR: currentTheme.outlines.default,
  HIGHLIGHT_COLOR: currentTheme.outlines.pin,
  PINNED_OUTLINE_COLOR: currentTheme.outlines.pin,
  HOVER_OUTLINE_COLOR: currentTheme.outlines.hover,
  HOVER_WHILE_PINNED_OUTLINE_COLOR: currentTheme.outlines.hoverWhilePinned,
  RARE_NO_MATCH_COLOR: [0.25, 0.25, 0.25] as Color, // intentionally palette-agnostic (see Task 14)
} as const;
```

Note: `as const` no longer applies cleanly across mixed literal/computed values. If TS complains, drop `as const` and add explicit type annotations to each Color field (or define `HIGHLIGHT_CONSTANTS: { ... }`).

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: PASS — same count as baseline.

- [ ] **Step 4: Run typechecker**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Smoke-test the dev server**

Run: `npm run dev`
Open `http://localhost:5173/` in a browser. Confirm: bg is the shipped grey, verses look identical to before. (Then stop the dev server.)

- [ ] **Step 6: Commit**

```bash
git add src/constants.ts
git commit -m "refactor(constants): source color fields from currentTheme"
```

---

## Task 4: Wire `SEARCH_COLORS` to `currentTheme.searchHues`

**Files:**
- Modify: `src/utils/color.ts`

- [ ] **Step 1: Replace SEARCH_COLORS literal with theme read**

Modify `src/utils/color.ts`:

```ts
// src/utils/color.ts
import type { Color } from '../overlays/types.ts';
import { currentTheme } from '../themes.ts';

export const HIGHLIGHT_COLOR: Color = currentTheme.outlines.pin;
export const DIM_FACTOR = 0.3;

export const SEARCH_COLORS: Color[] = currentTheme.searchHues;
```

Delete the inline comment block describing the shipped hue choices; that lives in the theme record now.

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Smoke-test the dev server**

Run: `npm run dev`. Open with a multi-term search (e.g. `?q=Rebekah,plague,Sinai`). Confirm: the five search hues are unchanged from before.

- [ ] **Step 4: Commit**

```bash
git add src/utils/color.ts
git commit -m "refactor(color): source SEARCH_COLORS from currentTheme"
```

---

## Task 5: Add dust tint support to verse coloring

`refined-grey` has no tint (verses are neutral grey). The five new themes use tints. Wire it up now so later themes work end-to-end.

**Files:**
- Modify: `src/itemColoring.ts` (or wherever `MIN_BRIGHTNESS + Math.random() * BRIGHTNESS_RANGE` produces the dust color)
- Test: existing `src/__tests__/unit/verseColoring.test.ts` updated

- [ ] **Step 1: Read the current dust-color computation**

The neutral-grey dust ramp lives in `getDefaultColor(index)` in `src/itemColoring.ts`. Confirmed shape (per the existing `verseColoring.test.ts`): with `seededRandom` mocked to `0.5`, it returns `[b, b, b]` where `b = MIN_BRIGHTNESS + 0.5 * BRIGHTNESS_RANGE`. Modify that function.

- [ ] **Step 2: Add a failing test for tint application to `verseColoring.test.ts`**

```ts
import { currentTheme } from '../../themes';

it('applies dust.tint multiplicatively when currentTheme has one', () => {
  const origTint = currentTheme.dust.tint;
  try {
    (currentTheme.dust as { tint?: Color }).tint = [1.0, 0.5, 0.4];
    vi.spyOn(randomModule, 'seededRandom').mockReturnValue(0.5);
    const b = currentTheme.dust.min + 0.5 * (currentTheme.dust.max - currentTheme.dust.min);
    const color = getDefaultColor(0);
    expect(color[0]).toBeCloseTo(1.0 * b, 10);
    expect(color[1]).toBeCloseTo(0.5 * b, 10);
    expect(color[2]).toBeCloseTo(0.4 * b, 10);
  } finally {
    (currentTheme.dust as { tint?: Color }).tint = origTint;
  }
});
```

Run: `npx vitest run src/__tests__/unit/verseColoring.test.ts -t 'tint multiplicatively'`. Expected: FAIL — current `getDefaultColor` returns `[b, b, b]` regardless of tint.

- [ ] **Step 3: Implement the tint multiplication in `getDefaultColor`**

In `src/itemColoring.ts`, replace the body of `getDefaultColor` so the brightness-to-color step honors the tint:

```ts
const b = currentTheme.dust.min + rand * (currentTheme.dust.max - currentTheme.dust.min);
const tint = currentTheme.dust.tint;
const color: Color = tint
  ? [tint[0] * b, tint[1] * b, tint[2] * b]
  : [b, b, b];
return color;
```

Add the missing import: `import { currentTheme } from './themes';`. The existing reads via `HIGHLIGHT_CONSTANTS.MIN_BRIGHTNESS / BRIGHTNESS_RANGE` continue to work (Task 3 already pointed them at `currentTheme`), but switching to read `currentTheme.dust.{min,max}` directly is cleaner here.

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: PASS. `refined-grey` (no tint) keeps its current output exactly.

- [ ] **Step 5: Smoke-test dev server**

Run: `npm run dev`. Confirm refined-grey verses look identical to before.

- [ ] **Step 6: Commit**

```bash
git add src/itemColoring.ts src/__tests__/unit/verseColoring.test.ts
git commit -m "feat(itemColoring): support dust tint from currentTheme"
```

---

## Task 6: CSS chrome via `:root` custom properties

**Files:**
- Modify: `src/themes.ts` (add `applyChromeVars`)
- Modify: `src/main.ts` (call it on boot)
- Modify: `src/styles/main.css`, `src/styles/hebrewKeyboard.css`, `src/styles/help.css`

- [ ] **Step 1: Add applyChromeVars to themes.ts**

Append:

```ts
export function applyChromeVars(t: CoreTheme = currentTheme): void {
  const root = document.documentElement;
  root.style.setProperty('--bg', t.cssBg);
  root.style.setProperty('--fg', t.chrome.fg);
  root.style.setProperty('--sidebar-bg', t.chrome.sidebarBg);
  root.style.setProperty('--sidebar-fg', t.chrome.sidebarFg);
  root.style.setProperty('--link', t.chrome.link);
}
```

- [ ] **Step 2: Write a test for applyChromeVars**

Append to `themes.test.ts`:

```ts
import { applyChromeVars } from '../../themes.ts';

describe('applyChromeVars', () => {
  it('writes CSS custom properties on :root from theme.chrome', () => {
    applyChromeVars(THEMES['refined-grey']);
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#1a1a1a');
    expect(document.documentElement.style.getPropertyValue('--fg')).toBe('#fff');
  });
});
```

Run: `npx vitest run src/__tests__/unit/themes.test.ts`. Expected: PASS.

- [ ] **Step 3: Call applyChromeVars at boot**

In `src/main.ts`, near other one-time setup, before any DOM mutation:

```ts
import { applyChromeVars } from './themes.ts';
applyChromeVars();
```

- [ ] **Step 4: Migrate the most visible chrome colors to vars**

Find: `grep -n '#1a1a1a\|#fff\|rgba(0, 0, 0, 0.85)\|#aaa' src/styles/*.css src/styles/overlays/*.css`

In `src/styles/main.css` and any chrome stylesheet found, replace:
- `background: #1a1a1a` → `background: var(--bg)`
- `color: #fff` → `color: var(--fg)` (inside `#controls`, `#sidebar`, etc. — not inside contexts like inline overlay tooltips)
- `background: rgba(0, 0, 0, 0.85)` → `background: var(--sidebar-bg)` for the controls/sidebar panels
- `color: #aaa` → `color: var(--sidebar-fg)` for labels inside chrome

Scope: migrate ONLY the chrome surfaces (body, `#controls`, `#sidebar`, `#help`). Leave inline-styled overlay UI hardcoded — those are tracked under per-overlay tasks if they need it.

- [ ] **Step 5: Smoke-test**

Run: `npm run dev`. Confirm refined-grey app looks identical to before.

- [ ] **Step 6: Commit**

```bash
git add src/themes.ts src/main.ts src/styles src/__tests__/unit/themes.test.ts
git commit -m "feat(themes): wire CSS chrome via :root custom properties"
```

---

## Task 7: Add `newsprint` theme (light)

Just the core record. Data-driven overlays will fall back to refined-grey's stops until Tasks 13–15 introduce polarity fallback proper — that's fine for a probe.

**Files:**
- Modify: `src/themes.ts`

- [ ] **Step 1: Add the `newsprint` entry to `THEMES`**

```ts
newsprint: {
  id: 'newsprint',
  name: 'Newsprint',
  polarity: 'light',
  bg: [0.957, 0.937, 0.902],
  cssBg: '#f4efe6',
  dust: { min: 0.10, max: 0.42, tint: [0.20, 0.16, 0.12] },
  dim: 0.78,
  searchHues: [
    [0.722, 0.200, 0.118], // Vermillion
    [0.122, 0.239, 0.416], // Lapis
    [0.180, 0.420, 0.227], // Verdigris
    [0.486, 0.227, 0.686], // Imperial
    [0.784, 0.588, 0.122], // Ochre
  ],
  outlines: {
    default: [0.30, 0.25, 0.20],
    hover:   [0.10, 0.08, 0.06],
    pin:     [0.45, 0.10, 0.05],
    hoverWhilePinned: [0.55, 0.40, 0.05],
  },
  chrome: {
    fg: '#1a1410',
    sidebarBg: 'rgba(244, 239, 230, 0.92)',
    sidebarFg: '#5a4a3a',
    link: '#3a4a8a',
  },
},
```

- [ ] **Step 2: Run all tests**

Run: `npm test`. Expected: PASS — newsprint's record is exhaustive; no test asserts behavior of `?theme=newsprint`.

- [ ] **Step 3: Smoke-test the theme**

Run: `npm run dev`. Open `http://localhost:5173/?theme=newsprint`. Confirm: light cream bg, dark dust, body and chrome have flipped. Data overlays will look off-tune — that's expected at this task.

- [ ] **Step 4: Commit**

```bash
git add src/themes.ts
git commit -m "feat(themes): add newsprint (light polarity)"
```

---

## Task 8: Add `plum` theme

**Files:**
- Modify: `src/themes.ts`

- [ ] **Step 1: Add the `plum` entry to `THEMES`**

```ts
plum: {
  id: 'plum',
  name: 'Risograph Plum',
  polarity: 'dark',
  bg: [0.118, 0.078, 0.161],
  cssBg: '#1e1429',
  dust: { min: 0.62, max: 0.95, tint: [1.0, 0.95, 0.85] },
  dim: 0.40,
  searchHues: [
    [1.000, 0.369, 0.569], // Fluoro pink
    [0.231, 0.420, 0.820], // Federal blue
    [0.435, 0.831, 0.659], // Mint
    [1.000, 0.761, 0.227], // Marigold
    [0.169, 0.706, 0.659], // Teal
  ],
  outlines: {
    default: [0.65, 0.60, 0.55],
    hover:   [1.0, 0.95, 0.85],
    pin:     [1.000, 0.369, 0.569],
    hoverWhilePinned: [1.000, 0.761, 0.227],
  },
  chrome: {
    fg: '#f5ecdc',
    sidebarBg: 'rgba(30, 20, 41, 0.92)',
    sidebarFg: '#b8a4c8',
    link: '#ff8eb5',
  },
},
```

- [ ] **Step 2: Run tests**

Run: `npm test`. Expected: PASS.

- [ ] **Step 3: Smoke-test**

Open `http://localhost:5173/?theme=plum`. Confirm: deep plum bg, warm-cream verses, distinctive risograph search hues.

- [ ] **Step 4: Commit**

```bash
git add src/themes.ts
git commit -m "feat(themes): add risograph plum"
```

---

## Task 9: Add `oxblood` theme

**Files:**
- Modify: `src/themes.ts`

- [ ] **Step 1: Add the `oxblood` entry to `THEMES`**

```ts
oxblood: {
  id: 'oxblood',
  name: 'Oxblood Folio',
  polarity: 'dark',
  bg: [0.110, 0.078, 0.063],
  cssBg: '#1c1410',
  dust: { min: 0.30, max: 0.88, tint: [1.00, 0.55, 0.45] },
  dim: 0.32,
  searchHues: [
    [0.306, 0.804, 0.769], // Teal
    [0.957, 0.827, 0.369], // Gold
    [0.655, 0.525, 0.875], // Violet
    [0.616, 0.851, 0.953], // Ice-blue
    [0.784, 0.910, 0.478], // Lime
  ],
  outlines: {
    default: [0.55, 0.45, 0.40],
    hover:   [0.92, 0.86, 0.78],
    pin:     [0.957, 0.827, 0.369],
    hoverWhilePinned: [0.306, 0.804, 0.769],
  },
  chrome: {
    fg: '#ebdfd1',
    sidebarBg: 'rgba(28, 20, 16, 0.92)',
    sidebarFg: '#b39e88',
    link: '#f4d35e',
  },
},
```

- [ ] **Step 2: Run tests**

Run: `npm test`. Expected: PASS.

- [ ] **Step 3: Smoke-test**

Open `http://localhost:5173/?theme=oxblood`. Confirm: warm coffee bg, oxblood-warm verses, cool search hues popping.

- [ ] **Step 4: Commit**

```bash
git add src/themes.ts
git commit -m "feat(themes): add oxblood folio"
```

---

## Task 10: Add `manuscript` theme (light probe)

**Files:**
- Modify: `src/themes.ts`

- [ ] **Step 1: Add the `manuscript` entry to `THEMES`**

```ts
manuscript: {
  id: 'manuscript',
  name: 'Illuminated Manuscript',
  polarity: 'light',
  bg: [0.949, 0.906, 0.784],
  cssBg: '#f2e7c8',
  dust: { min: 0.18, max: 0.50, tint: [0.55, 0.45, 0.30] },
  dim: 0.72,
  searchHues: [
    [0.784, 0.141, 0.102], // Vermillion
    [0.102, 0.290, 0.541], // Lapis
    [0.780, 0.576, 0.129], // Gold
    [0.180, 0.427, 0.235], // Verdigris
    [0.420, 0.102, 0.369], // Purple
  ],
  outlines: {
    default: [0.40, 0.32, 0.20],
    hover:   [0.20, 0.13, 0.06],
    pin:     [0.55, 0.10, 0.05],
    hoverWhilePinned: [0.60, 0.30, 0.05],
  },
  chrome: {
    fg: '#2b1f0d',
    sidebarBg: 'rgba(242, 231, 200, 0.92)',
    sidebarFg: '#6b5530',
    link: '#5a3a8a',
  },
},
```

- [ ] **Step 2-4: tests, smoke-test, commit**

```bash
git add src/themes.ts
git commit -m "feat(themes): add illuminated manuscript (light probe)"
```

---

## Task 11: Add `okabe` theme

**Files:**
- Modify: `src/themes.ts`

- [ ] **Step 1: Add the `okabe` entry to `THEMES`**

```ts
okabe: {
  id: 'okabe',
  name: 'Okabe-Ito',
  polarity: 'dark',
  bg: [0.039, 0.063, 0.125],
  cssBg: '#0a1020',
  dust: { min: 0.45, max: 0.88, tint: [0.62, 0.68, 0.85] },
  dim: 0.42,
  searchHues: [
    [0.902, 0.624, 0.000], // Orange
    [0.337, 0.706, 0.914], // Sky blue
    [0.000, 0.620, 0.451], // Bluish green
    [0.941, 0.894, 0.259], // Yellow
    [0.800, 0.475, 0.655], // Reddish purple
  ],
  outlines: {
    default: [0.50, 0.55, 0.65],
    hover:   [0.95, 0.95, 1.00],
    pin:     [0.902, 0.624, 0.000],
    hoverWhilePinned: [0.941, 0.894, 0.259],
  },
  chrome: {
    fg: '#dce4f5',
    sidebarBg: 'rgba(10, 16, 32, 0.92)',
    sidebarFg: '#8a9ac8',
    link: '#56b4e9',
  },
},
```

- [ ] **Step 2-4: tests, smoke-test, commit**

```bash
git add src/themes.ts
git commit -m "feat(themes): add okabe-ito (aesthetic slot)"
```

---

## Task 12: Wire Talmud constants with polarity fallback

Bring the Talmud structural-color surface into the theme registry. The wiring shape is parallel to the Tanakh side: constants module + overlay consumers. `currentTheme.talmud` is optional; missing entries fall back to a polarity-keyed default. For v1 we ship polarity fallback only — no per-theme Talmud entries on the records yet (those become follow-up issues alongside per-theme Tanakh overlay tunings).

**Files:**
- Modify: `src/talmud/constants.ts`
- Modify: `src/talmud/overlays/segment-length.ts`

- [ ] **Step 1: Add a `ThemedTable<TalmudTheme>` at the top of `src/talmud/constants.ts`**

Prepend to the file (after the existing leading comment):

```ts
import { currentTheme, pick, type ThemedTable, type TalmudTheme } from '../themes.ts';
import type { Color } from '../overlays/types.ts';

// Refined-grey's Talmud values = the literals shipped before the registry refactor.
// They live inline here (not in src/themes.ts) so the Talmud color story stays
// co-located with the Talmud constants module.
const REFINED_GREY_TALMUD: TalmudTheme = {
  mishnahBase: [0.48, 0.58, 0.82],
  gemaraBase:  [0.58, 0.58, 0.58],
  sederBackgrounds: {
    'Seder Zeraim':   [0.45, 0.65, 0.40],
    'Seder Moed':     [0.35, 0.55, 0.85],
    'Seder Nashim':   [0.85, 0.50, 0.55],
    'Seder Nezikin':  [0.85, 0.70, 0.30],
    'Seder Kodashim': [0.55, 0.40, 0.75],
    'Seder Tahorot':  [0.40, 0.75, 0.75],
  },
  sederBackgroundOpacity: 0.10,
  segmentLength: { pale: [0.95, 0.95, 0.6], dark: [0.6, 0.15, 0.1] },
};

const TALMUD_TABLE: ThemedTable<TalmudTheme> = {
  byTheme: { 'refined-grey': REFINED_GREY_TALMUD },
  lightFallback: {
    // Mishnah/Gemara: deeper saturation so they read against cream; Mishnah
    // keeps its blue identity but moves toward indigo; Gemara becomes warm-dark grey.
    mishnahBase: [0.18, 0.28, 0.55],
    gemaraBase:  [0.28, 0.25, 0.22],
    // Seder backgrounds: darker tints at slightly higher opacity so they read
    // as tonal washes on cream rather than washing it out further.
    sederBackgrounds: {
      'Seder Zeraim':   [0.20, 0.40, 0.18],
      'Seder Moed':     [0.15, 0.30, 0.60],
      'Seder Nashim':   [0.55, 0.20, 0.28],
      'Seder Nezikin':  [0.60, 0.40, 0.10],
      'Seder Kodashim': [0.30, 0.18, 0.50],
      'Seder Tahorot':  [0.20, 0.45, 0.45],
    },
    sederBackgroundOpacity: 0.14,
    segmentLength: { pale: [0.40, 0.32, 0.10], dark: [0.55, 0.10, 0.05] },
  },
};

// Resolve once at module load; `currentTheme` is fixed for the page lifetime.
const talmud: TalmudTheme = currentTheme.talmud ?? pick(TALMUD_TABLE);
```

Note: `currentTheme.talmud` (the per-theme override) is checked *before* `pick()` because if a theme explicitly defines `talmud`, that wins over both the table and the polarity fallback. `pick()` itself only knows about `byTheme[id]` and the polarity fallback — the per-theme `talmud` field is a separate axis that lives on the theme record itself.

- [ ] **Step 2: Replace the literal exports with reads off `talmud`**

In the same file, change the four exports to read from the resolved `talmud`:

```ts
// Was: export const MISHNAH_BASE_COLOR: readonly [number, number, number] = [0.48, 0.58, 0.82];
export const MISHNAH_BASE_COLOR: Color = talmud.mishnahBase;
export const GEMARA_BASE_COLOR:  Color = talmud.gemaraBase;
export const SEDER_BACKGROUND_COLORS: Readonly<Record<string, Color>> = talmud.sederBackgrounds;
export const SEDER_BACKGROUND_OPACITY = talmud.sederBackgroundOpacity;
```

Resolution happens once at module load (when `talmud` is initialized above), matching the page-lifetime semantics of `currentTheme` itself.

- [ ] **Step 3: Wire segment-length overlay's `PALE` / `DARK` off the same `talmud` value**

In `src/talmud/overlays/segment-length.ts`:

```ts
// Was:
// const PALE: Color = [0.95, 0.95, 0.6];
// const DARK: Color = [0.6, 0.15, 0.1];

// Replace with:
import { SEDER_BACKGROUND_COLORS as _ } from '../constants.ts'; // ensures constants.ts evaluates first
import { currentTheme, pick, type ThemedTable, type TalmudTheme } from '../../themes.ts';

const SEGMENT_LENGTH_TABLE: ThemedTable<TalmudTheme['segmentLength']> = {
  byTheme: { 'refined-grey': { pale: [0.95, 0.95, 0.6],  dark: [0.6, 0.15, 0.1] } },
  lightFallback: { pale: [0.40, 0.32, 0.10], dark: [0.55, 0.10, 0.05] },
};

const { pale: PALE, dark: DARK } =
  currentTheme.talmud?.segmentLength ?? pick(SEGMENT_LENGTH_TABLE);
```

The values intentionally mirror `REFINED_GREY_TALMUD.segmentLength` and the light-fallback `segmentLength` in `talmud/constants.ts`. Both kept local because cross-file imports for a 4-number literal are not worth the coupling. If you find yourself needing to keep them in sync, that's a signal to extract — but YAGNI until then.

- [ ] **Step 4: Run all tests**

Run: `npm test`. Expected: PASS. The Talmud constants resolve to the same dark-polarity values as before for `refined-grey`.

- [ ] **Step 5: Run typechecker**

Run: `npm run typecheck`. Expected: PASS.

- [ ] **Step 6: Smoke-test both polarities**

Open the Talmud route in the dev server (`npm run dev`, then navigate to whatever URL `src/main-talmud.ts` registers — check `index.html` or the Vite config if unsure).

- `?theme=refined-grey` (or no param): visual identical to before.
- `?theme=newsprint`: Mishnah blocks read as deep indigo against cream; Gemara reads as warm-dark grey; seder background washes darken to tonal stripes rather than near-invisible pastels.

- [ ] **Step 7: Commit**

```bash
git add src/talmud/constants.ts src/talmud/overlays/segment-length.ts
git commit -m "feat(talmud): route structural colors through currentTheme with polarity fallback"
```

---

## Task 13: Per-theme commentary heatmap with polarity fallback

Extract the hardcoded heatmap gradient from `heatmapColor()` into a `ThemedTable<ColorStop[]>`, using the `pick<T>` helper defined in Task 2.

> **Expected look of an un-tuned theme.** When a non-refined-grey theme renders a data overlay with the polarity fallback, the result is *legible but not aesthetically tuned to that theme's bg hue*. Plum + commentary will read slightly muddy because the dark fallback (refined-grey's stops) carries no purple cast to harmonize with Plum's bg. This is deliberate: it signals "tune me" without breaking the visualization. Do not interpret "Plum + commentary looks slightly muddy" as a bug in the registry — it means Plum hasn't yet graduated past the probe stage for that overlay. The same caveat applies to Tasks 14 (trop) and 15 (text-dating) and to the Talmud polarity fallback in Task 12.

**Files:**
- Modify: `src/utils/color.ts`

- [ ] **Step 1: Refactor `heatmapColor` to use the helper**

Replace the body of `heatmapColor` and add the tables above it:

```ts
import { currentTheme, pick, type ThemedTable } from '../themes.ts';

const HEATMAP: ThemedTable<ColorStop[]> = {
  byTheme: {
    'refined-grey': [
      { t: 0,    color: [0.1,  0.13, 0.18] },
      { t: 0.25, color: [0.1,  0.23, 0.38] },
      { t: 0.5,  color: [0.2,  0.43, 0.33] },
      { t: 0.75, color: [0.9,  0.33, 0.13] },
      { t: 1.0,  color: [1.0,  0.23, 0.18] },
    ],
  },
  lightFallback: [
    { t: 0,    color: [0.92, 0.88, 0.78] }, // paper
    { t: 0.25, color: [0.78, 0.72, 0.55] },
    { t: 0.5,  color: [0.62, 0.45, 0.28] },
    { t: 0.75, color: [0.55, 0.18, 0.10] },
    { t: 1.0,  color: [0.42, 0.05, 0.02] }, // deep burgundy
  ],
};

const HEATMAP_EMPTY: ThemedTable<Color> = {
  byTheme: { 'refined-grey': [0.15, 0.15, 0.20] },
  lightFallback: [0.92, 0.88, 0.78],
};

export function heatmapColor(value: number, maxValue: number): Color {
  if (value === 0) return pick(HEATMAP_EMPTY);
  return scaleToGradient(value, maxValue, pick(HEATMAP), { useLog: true });
}
```

- [ ] **Step 2: Run all tests**

Run: `npm test`. Expected: PASS (refined-grey theme yields identical output to before).

- [ ] **Step 3: Smoke-test on light bg**

Run: `npm run dev`. Open `http://localhost:5173/?theme=newsprint` and switch to the Commentary overlay. Confirm: empty-state cells are paper-tone (not near-black), peaks read as deep burgundy. (Light-polarity fallback doing its job.)

- [ ] **Step 4: Commit**

```bash
git add src/utils/color.ts
git commit -m "feat(heatmap): per-theme stops with polarity fallback"
```

---

## Task 14: Per-theme trop palette with polarity fallback

Covers the gradient stops, the `RARE_MATCH_COLOR`, **and** the two empty-state literals at lines 80 & 86 (`[0.25, 0.25, 0.28]` for uncommon-with-zero-count, `[0.25, 0.23, 0.28]` for common-with-zero-count) — those went near-black to read on dark bg, but disappear on light. They belong in `TropPalette`.

**Files:**
- Modify: `src/overlays/trop.ts`

- [ ] **Step 1: Build the table**

Replace the hardcoded gradient stops, `RARE_MATCH_COLOR`, AND the two count-zero literals (currently at `src/overlays/trop.ts:26,50-59,80,86`):

```ts
import { pick, type ThemedTable } from '../themes.ts';

interface TropPalette {
  defaultGradient: ColorStop[];
  selectedGradient: ColorStop[];
  rareMatch: Color;
  emptyUncommon: Color;     // returned when uncommon-tier count = 0
  emptyCommon: Color;       // returned when common-tier count = 0
}

const TROP: ThemedTable<TropPalette> = {
  byTheme: {
    'refined-grey': {
      defaultGradient: [
        { t: 0,    color: [0.4, 0.2, 0.6] },
        { t: 1,    color: [0.9, 0.4, 0.95] },
      ],
      selectedGradient: [
        { t: 0,    color: [0.2, 0.1, 0.3] },
        { t: 0.33, color: [0.4, 0.2, 0.5] },
        { t: 0.66, color: [0.7, 0.3, 0.7] },
        { t: 1.0,  color: [0.95, 0.6, 0.9] },
      ],
      rareMatch: [1.0, 0.84, 0.0],
      emptyUncommon: [0.25, 0.25, 0.28],
      emptyCommon:   [0.25, 0.23, 0.28],
    },
  },
  lightFallback: {
    defaultGradient: [
      { t: 0, color: [0.55, 0.35, 0.65] },
      { t: 1, color: [0.30, 0.10, 0.45] },
    ],
    selectedGradient: [
      { t: 0,    color: [0.75, 0.60, 0.80] },
      { t: 0.33, color: [0.55, 0.35, 0.65] },
      { t: 0.66, color: [0.35, 0.15, 0.50] },
      { t: 1.0,  color: [0.20, 0.05, 0.35] },
    ],
    rareMatch: [0.60, 0.40, 0.05],
    emptyUncommon: [0.78, 0.74, 0.68],     // muted paper-tone, not near-bg
    emptyCommon:   [0.78, 0.72, 0.66],
  },
};
```

Then update the four call sites in the file that used the old constants:
- gradient stops → `pick(TROP).defaultGradient` / `pick(TROP).selectedGradient`
- `RARE_MATCH_COLOR` → `pick(TROP).rareMatch`
- `[0.25, 0.25, 0.28]` at line 80 (uncommon, count=0) → `pick(TROP).emptyUncommon`
- `[0.25, 0.23, 0.28]` at line 86 (common, count=0) → `pick(TROP).emptyCommon`

If the engineer prefers a single resolution per render frame, hoist to a module-load `const trop = pick(TROP)` and read fields off it. Both are equivalent here since `currentTheme` is fixed for the page lifetime — readability tradeoff only.

Leave `HIGHLIGHT_CONSTANTS.RARE_NO_MATCH_COLOR` (`[0.25, 0.25, 0.25]`) untouched — it's a single muted neutral that reads fine on both polarities, and promoting it to a per-theme value adds surface area for no payoff this round.

- [ ] **Step 2: Run all tests**

Run: `npm test`. Expected: PASS.

- [ ] **Step 3: Smoke-test**

Open `?theme=refined-grey` Trop overlay — visual identical to before. Then `?theme=newsprint` Trop overlay — purples darken (not invisible-cream).

- [ ] **Step 4: Commit**

```bash
git add src/overlays/trop.ts
git commit -m "feat(trop): per-theme palette with polarity fallback"
```

---

## Task 15: Per-theme text-dating eras with polarity fallback

**Files:**
- Modify: `src/overlays/text-dating.ts`

- [ ] **Step 1: Move era colors into a `ThemedTable<Color[]>`**

In `src/overlays/text-dating.ts`, extract `baseColor` out of `ERAS` and add the table:

```ts
import { pick, type ThemedTable } from '../themes.ts';

// Era ordering matches ERAS array indices.
const ERA_COLORS: ThemedTable<Color[]> = {
  byTheme: {
    'refined-grey': [
      [0.60, 0.25, 0.15], // Pre-Monarchic
      [0.75, 0.40, 0.20], // Early Monarchic
      [0.85, 0.55, 0.25], // Late Monarchic
      [0.85, 0.70, 0.35], // Exilic
      [0.75, 0.75, 0.50], // Persian
      [0.80, 0.80, 0.70], // Hellenistic
    ],
  },
  lightFallback: [
    [0.45, 0.15, 0.08], // Pre-Monarchic — deeper red-brown for light bg
    [0.65, 0.30, 0.10],
    [0.75, 0.45, 0.15],
    [0.75, 0.60, 0.25],
    [0.55, 0.55, 0.30],
    [0.35, 0.30, 0.18], // Hellenistic — dark enough to read on cream
  ],
};

function eraColors(): Color[] {
  return pick(ERA_COLORS);
}
```

Remove the `baseColor` field from `EraInfo` and from each entry in `ERAS`. Update every read site that destructured `era.baseColor` (search the file: `grep -n 'baseColor' src/overlays/text-dating.ts`) to read `eraColors()[index]` instead, where `index` is the era's position in `ERAS`. Concretely: change `era.baseColor` to `eraColors()[ERAS.indexOf(era)]` at each call site, or — cleaner — refactor the relevant helper to take an `eraIndex` parameter so the lookup happens once.

- [ ] **Step 2: Run all tests**

Run: `npm test`. Expected: PASS.

- [ ] **Step 3: Smoke-test**

`?theme=refined-grey` text-dating — identical. `?theme=newsprint` text-dating — Hellenistic era no longer disappears into cream bg.

- [ ] **Step 4: Commit**

```bash
git add src/overlays/text-dating.ts
git commit -m "feat(text-dating): per-theme era colors with polarity fallback"
```

---

## Task 16: Apply dust tint to the search overlay's dim formula

**Why this matters:** the search overlay's "dim non-match" formula in `src/overlays/search.ts:623-624` returns `[b, b, b]` — a neutral grey at `currentTheme.dim`. This bypasses `currentTheme.dust.tint`, so on tinted dark themes (Plum, Oxblood) and on light themes the dimmed verses become the WRONG color relative to the normal-state dust ramp. Memory feedback from a prior session flagged this exact pattern as a known failure mode.

**Files:**
- Modify: `src/overlays/search.ts`
- Test: `src/__tests__/unit/overlays/search.test.ts`

- [ ] **Step 1: Write a failing test**

Add to `src/__tests__/unit/overlays/search.test.ts`:

```ts
import { currentTheme } from '../../../themes';
import { searchOverlay } from '../../../overlays/search';
import type { Color } from '../../../overlays/types';

it('dimmed non-match colors honor currentTheme.dust.tint', () => {
  const origTint = currentTheme.dust.tint;
  const origDim  = currentTheme.dim;
  try {
    (currentTheme.dust as { tint?: Color }).tint = [1.0, 0.5, 0.4];
    (currentTheme as { dim: number }).dim = 0.5;
    // Ensure search is active with some term, so the verse-being-tested falls
    // into the "no-match-while-search-active" branch. (Use whatever the
    // existing harness does to activate a search.)
    // Then read the color for a known non-match verse:
    const color = searchOverlay.getVerseColor(/* some-non-matching-verse */) as Color;
    expect(color[0]).toBeCloseTo(0.50, 10);  // 1.0 * 0.5
    expect(color[1]).toBeCloseTo(0.25, 10);  // 0.5 * 0.5
    expect(color[2]).toBeCloseTo(0.20, 10);  // 0.4 * 0.5
  } finally {
    (currentTheme.dust as { tint?: Color }).tint = origTint;
    (currentTheme as { dim: number }).dim = origDim;
  }
});
```

(Shape the search-activation step to match how existing tests in this file activate a search. Read the file end-to-end first.)

Run: `npx vitest run src/__tests__/unit/overlays/search.test.ts -t 'tint'`. Expected: FAIL — current formula returns `[0.5, 0.5, 0.5]`.

- [ ] **Step 2: Apply the tint in the dim formula**

In `src/overlays/search.ts`, replace lines 623-624:

```ts
// Was:
// const b = HIGHLIGHT_CONSTANTS.DIM_BRIGHTNESS;
// return [b, b, b];

import { currentTheme } from '../themes.ts'; // add to existing imports

const b = currentTheme.dim;
const tint = currentTheme.dust.tint;
return tint ? [tint[0] * b, tint[1] * b, tint[2] * b] : [b, b, b];
```

The two-line pattern matches `getDefaultColor` in `itemColoring.ts` from Task 5 — same shape, same semantics.

- [ ] **Step 3: Run all tests**

Run: `npm test`. Expected: PASS. Existing search-dim tests that assert `[b, b, b]` for refined-grey (which has no tint) still hold; the new test for tinted themes also passes.

- [ ] **Step 4: Smoke-test on a tinted theme**

Open `http://localhost:5173/?theme=oxblood` and run a single-term search. Dimmed non-matches should now be **warm-red dim** (recede into the oxblood ground), not **neutral grey** (which would stand out).

- [ ] **Step 5: Commit**

```bash
git add src/overlays/search.ts src/__tests__/unit/overlays/search.test.ts
git commit -m "fix(search): dim formula honors currentTheme.dust.tint"
```

---

## Task 17: Audit verse-length overlay; document PLASMA palette decision

`src/overlays/verse-length.ts` uses `PLASMA_STOPS` (perceptually-uniform purple → magenta → orange → yellow). Perceptually-uniform palettes are palette-agnostic by design: both luminance endpoints are visible against any background luminance. Verify this claim, document it, and move on — do not introduce per-theme variants.

**Files:**
- Modify: `src/overlays/verse-length.ts` (comment only)

- [ ] **Step 1: Read the file end-to-end**

Confirm: `getPaletteColor(t)` returns colors from `PLASMA_STOPS` with no bg reference. The stops span L≈0.05 (dark indigo) to L≈0.55 (bright yellow) — both readable on dark bg (yellow pops) and light bg (indigo pops).

- [ ] **Step 2: Add an audit comment**

Above the `PLASMA_STOPS` declaration in `src/overlays/verse-length.ts`:

```ts
// Palette-agnostic by design: perceptually-uniform gradient with luminance
// endpoints at L≈0.05 (dark indigo) and L≈0.55 (yellow), so both ends are
// readable against any theme background. Do NOT add per-theme variants —
// it would break the perceptual uniformity that makes the visualization
// faithful to word-count differences.
```

- [ ] **Step 3: Smoke-test all six themes**

For each `?theme=<id>`, open the Verse Length overlay. Confirm: low-word-count verses (dark indigo) and high-word-count verses (yellow) are both legible on every bg.

- [ ] **Step 4: Commit**

```bash
git add src/overlays/verse-length.ts
git commit -m "chore(verse-length): document palette-agnostic audit"
```

---

## Task 18: Verify haftarah is palette-agnostic; document

**Files:**
- Modify: `src/overlays/haftarah.ts` (comment only, expected)

- [ ] **Step 1: Read haftarah's color flow**

Read `src/overlays/haftarah.ts` end to end. Trace `desaturate(color, factor)`: it preserves L, lowers S. On a light bg of L≈0.95, a desaturated mid-saturation color at L≈0.55 is grey at L=0.55 — visible. Same on a dark bg. No bg reference.

- [ ] **Step 2: Add a comment documenting the audit**

At the top of `src/overlays/haftarah.ts`, above `desaturate`:

```ts
// Palette-agnostic: desaturate preserves L, lowers S. Renders OK on any bg
// luminance because output L is determined by the input color, not the theme.
// Re-audit when adding any chroma multiplier or bg-derived branching.
```

- [ ] **Step 3: Smoke-test all themes through the haftarah overlay**

Open each `?theme=<id>` with the haftarah overlay active. Confirm legibility on dark and light backgrounds.

- [ ] **Step 4: Commit**

```bash
git add src/overlays/haftarah.ts
git commit -m "chore(haftarah): document palette-agnostic audit"
```

---

## Task 19: Automated Playwright palette assertions

Programmatically verify that every (theme × state) combination renders the colors the theme records claim. This task runs *before* the screenshot harness in Task 20 — if the assertions catch a mismatch, fix the bug before generating PNGs for human review.

**Approach:** Playwright drives the existing dev server. For each `(theme, state)` tuple, navigate, wait for canvas to render, take a screenshot of a known region, decode the PNG with `pngjs`, sample fixed pixel coordinates, and assert the sampled colors are within tolerance of the theme record's claims. Exits non-zero on any failure.

**Files:**
- Create: `scripts/palette-assert.mjs`
- Create: `scripts/palette-samples.json` — fixed `(state, label, x, y)` sample points
- Modify: `package.json` — add `"palette:assert"` and `"palette:check"` (assert + verify combined)
- New runtime dep: `pngjs` (pixel decoding from screenshot)

### What gets asserted, per (theme, state):

| State | Assertion(s) |
|---|---|
| `default` (any) | Background pixel at `(2, 2)` matches `theme.bg` (Δ ≤ 4/255 per channel). Dust region average luminance is within `[theme.dust.min, theme.dust.max]` (with `theme.dust.tint` applied). |
| `search-single` (`?q=Sinai`) | Sample at a known Sinai-match coordinate: color matches one of `theme.searchHues` (Δ ≤ 8/255). Sample at a known non-match coordinate: matches `theme.dim * theme.dust.tint` (Δ ≤ 8/255 — verifies Task 16 fix). |
| `search-multi` | Sample at ≥3 known match coords: each maps to a *different* hue from `theme.searchHues` (no two return the same hue). |
| `commentary`, `trop`, `text-dating`, `haftarah`, `verse-length` | Background pixel still matches `theme.bg`. (Overlay-specific pixel assertions are deferred — they'd need per-overlay sample points that change with overlay logic. Theme-level assertions suffice for the registry's correctness.) |

Sample coordinates live in `scripts/palette-samples.json` so they can be tuned without touching the assertion code:

```json
{
  "default": [
    { "label": "bg", "x": 2, "y": 2 },
    { "label": "dust-genesis-1-1", "x": 120, "y": 80 }
  ],
  "search-single": [
    { "label": "bg", "x": 2, "y": 2 },
    { "label": "sinai-match", "x": 230, "y": 240 },
    { "label": "non-match-genesis-1-1", "x": 120, "y": 80 }
  ]
}
```

Coordinates are seeded from the existing `/tmp/torahmap-palettes/probe.mjs` if there's overlap; otherwise the engineer picks them by inspection during Step 4 below.

- [ ] **Step 1: Install `pngjs`**

```bash
npm install --save-dev pngjs
```

- [ ] **Step 2: Create `scripts/palette-samples.json`**

Open `http://localhost:5173/` (start dev server first), use the browser inspector to pick canvas-relative pixel coords for: background corner, one verse in Genesis 1 (dust), one verse in Exodus 20 (for Sinai search), one verse in Numbers 7 (for multi-term search). Record as JSON in the file shape above.

- [ ] **Step 3: Create `scripts/palette-assert.mjs`**

```js
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const THEMES_PATH = resolve('src/themes.ts');
// Import THEMES at runtime via dynamic import of a compiled artifact OR re-declare
// the relevant fields here keyed by id. Re-declare is simpler:
const THEME_EXPECTATIONS = {
  'refined-grey': { bg: [26, 26, 26], dustMin: 0.50, dustMax: 0.92, dim: 0.30, tint: null },
  'newsprint':    { bg: [244, 239, 230], dustMin: 0.10, dustMax: 0.42, dim: 0.78, tint: [0.20, 0.16, 0.12] },
  'plum':         { bg: [30, 20, 41], dustMin: 0.62, dustMax: 0.95, dim: 0.40, tint: [1.0, 0.95, 0.85] },
  'oxblood':      { bg: [28, 20, 16], dustMin: 0.30, dustMax: 0.88, dim: 0.32, tint: [1.00, 0.55, 0.45] },
  'manuscript':   { bg: [242, 231, 200], dustMin: 0.18, dustMax: 0.50, dim: 0.72, tint: [0.55, 0.45, 0.30] },
  'okabe':        { bg: [10, 16, 32], dustMin: 0.45, dustMax: 0.88, dim: 0.42, tint: [0.62, 0.68, 0.85] },
};

const STATES = [
  { name: 'default',       query: '' },
  { name: 'search-single', query: '?q=Sinai' },
  // ... (mirrors Task 20's STATES list)
];

const SAMPLES = JSON.parse(readFileSync(resolve('scripts/palette-samples.json'), 'utf8'));
const BASE = process.env.PROBE_URL ?? 'http://localhost:5173';

function sample(png, x, y) {
  const idx = (png.width * y + x) << 2;
  return [png.data[idx], png.data[idx + 1], png.data[idx + 2]];
}

function within(a, b, tolPerChannel) {
  return a.every((v, i) => Math.abs(v - b[i]) <= tolPerChannel);
}

function expectedDimRgb(exp) {
  const b = exp.dim;
  if (!exp.tint) return [Math.round(b * 255), Math.round(b * 255), Math.round(b * 255)];
  return [
    Math.round(exp.tint[0] * b * 255),
    Math.round(exp.tint[1] * b * 255),
    Math.round(exp.tint[2] * b * 255),
  ];
}

const browser = await chromium.launch({ headless: true, args: ['--headless=new'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

let failures = 0;
for (const [themeId, exp] of Object.entries(THEME_EXPECTATIONS)) {
  for (const state of STATES) {
    const sep = state.query.startsWith('?') ? '&' : '?';
    const url = `${BASE}${state.query}${state.query ? sep : '?'}theme=${themeId}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    const buf = await page.screenshot();
    const png = PNG.sync.read(buf);

    const stateSamples = SAMPLES[state.name] ?? [];
    for (const s of stateSamples) {
      const got = sample(png, s.x, s.y);

      if (s.label === 'bg') {
        if (!within(got, exp.bg, 4)) {
          console.error(`FAIL ${themeId} ${state.name} bg @(${s.x},${s.y}): got ${got}, want ${exp.bg}`);
          failures++;
        }
      } else if (s.label.startsWith('non-match')) {
        const want = expectedDimRgb(exp);
        if (!within(got, want, 8)) {
          console.error(`FAIL ${themeId} ${state.name} dim @(${s.x},${s.y}): got ${got}, want ${want}`);
          failures++;
        }
      }
      // Add more label handlers (dust-*, sinai-match, etc.) as samples are filled in.
    }
  }
}

await browser.close();
console.log(`\npalette:assert — ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 4: Add npm scripts**

In `package.json`'s `scripts`:

```json
"palette:assert": "node scripts/palette-assert.mjs",
"palette:check":  "npm run palette:assert && npm run palette:verify"
```

`palette:check` is the order you want for the PR gate: assertions first (cheap, fail-fast); then screenshots for human review.

- [ ] **Step 5: Run the assertions**

Dev server in another terminal: `npm run dev`.
Then: `npm run palette:assert`.
Expected: `palette:assert — 0 failure(s)` and exit 0.

If any failure: read the error lines, inspect the theme record vs. the sampled pixel, fix the wiring or the sample coordinate (samples may need re-picking if the layout shifts). Do **not** loosen tolerances to make red turn green — that defeats the gate.

- [ ] **Step 6: Commit**

```bash
git add scripts/palette-assert.mjs scripts/palette-samples.json package.json package-lock.json
git commit -m "chore(palette): add Playwright assertions for theme correctness"
```

---

## Task 20: Add `palette:verify` screenshot harness

**Files:**
- Create: `scripts/palette-verify.mjs`
- Modify: `package.json`

- [ ] **Step 1: Stub the script around the existing probe**

Inspect `/tmp/torahmap-palettes/probe.mjs` for the existing screenshot probe pattern. Replicate the relevant logic into `scripts/palette-verify.mjs`:

```js
// scripts/palette-verify.mjs
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const THEMES = ['refined-grey', 'newsprint', 'plum', 'oxblood', 'manuscript', 'okabe'];
const BASE = process.env.PROBE_URL ?? 'http://localhost:5173';
const OUT = resolve('docs/plans/data/palettes');

const STATES = [
  { name: 'default',         query: '' },
  { name: 'search-single',   query: '?q=Sinai' },
  { name: 'search-multi',    query: '?q=Rebekah,plague,Sinai,menorah,holiness' },
  { name: 'commentary',      query: '?overlay=commentary' },
  { name: 'trop',            query: '?overlay=trop' },
  { name: 'text-dating',     query: '?overlay=text-dating' },
  { name: 'haftarah',        query: '?overlay=haftarah' },
  { name: 'verse-length',    query: '?overlay=verse-length' },
];

const browser = await chromium.launch({ headless: true, args: ['--headless=new'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

for (const theme of THEMES) {
  await mkdir(`${OUT}/${theme}`, { recursive: true });
  for (const state of STATES) {
    const sep = state.query.startsWith('?') ? '&' : '?';
    const url = `${BASE}${state.query}${state.query ? sep : '?'}theme=${theme}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${OUT}/${theme}/${state.name}.png` });
    console.log(`✓ ${theme}/${state.name}.png`);
  }
}

await browser.close();
```

Note the `?q=` and `?overlay=` query params must match whatever URL-state shape `src/urlState.ts` already understands; check before running.

- [ ] **Step 2: Add the npm script**

In `package.json`'s `scripts`:

```json
"palette:verify": "node scripts/palette-verify.mjs"
```

- [ ] **Step 3: Run the verifier**

Run a dev server first: `npm run dev` (in another terminal).
Then: `npm run palette:verify`.
Expected: 42 PNGs under `docs/plans/data/palettes/`, one per (theme × state).

- [ ] **Step 4: Commit**

```bash
git add scripts/palette-verify.mjs package.json
git commit -m "chore(palette): add palette:verify screenshot harness"
```

- [ ] **Step 5: Optionally add the screenshots to git or .gitignore**

Decide: are the PNGs reference artifacts (commit them) or build output (gitignore them)? Default: gitignore — they regenerate, and binary diffs bloat history.

```bash
echo "docs/plans/data/palettes/" >> .gitignore
git add .gitignore
git commit -m "chore: ignore palette verify screenshots"
```

---

## Verification at end of plan

- [ ] All themes load without console errors. Try each: `http://localhost:5173/?theme=<id>` for `<id>` in `{refined-grey, newsprint, plum, oxblood, manuscript, okabe}`.
- [ ] Default (no `?theme=`) is visually identical to `main` before this branch.
- [ ] `npm test` passes (~1000+ tests).
- [ ] `npm run typecheck` clean.
- [ ] `npm run palette:assert` exits 0 with `0 failure(s)` — all (theme × state) pixel assertions hold.
- [ ] `npm run palette:check` (assertions then screenshots) succeeds end-to-end and produces 48 PNGs (8 states × 6 themes) for human review.
- [ ] Visual scan of each theme on each overlay: no overlay renders invisible (e.g. cream on cream); polarity fallbacks behave reasonably even on un-tuned themes.
- [ ] **Talmud route check**: for each theme, open the Talmud route. Confirm Mishnah/Gemara blocks remain legible and seder background washes read as tonal stripes (not invisible-pastel on cream).
- [ ] **Search-overlay tint check**: for `?theme=oxblood&q=Sinai`, dimmed non-match verses are warm-tinted dim (not neutral grey).
- [ ] **Trop empty-state check**: for `?theme=newsprint` with the trop overlay active, verses with count=0 in uncommon/common tiers are visible paper-tone (not near-black).

## Follow-up issues (file before PR exits draft)

The promotion-gate work (full per-theme tunings, not polarity fallback) is the next phase. File one issue per `(theme, overlay)` pair that needs proper tuning:

- newsprint × commentary heatmap (paper-tone tuning)
- newsprint × trop
- newsprint × text-dating
- newsprint × talmud (Mishnah/Gemara/Seder backgrounds for paper)
- plum × commentary
- plum × trop
- plum × text-dating
- plum × talmud
- oxblood × commentary
- oxblood × trop
- oxblood × text-dating
- oxblood × talmud
- manuscript × commentary
- manuscript × trop
- manuscript × text-dating
- manuscript × talmud
- okabe × commentary
- okabe × trop
- okabe × text-dating
- okabe × talmud

Plus two non-(theme × overlay) follow-ups:

- **Inline DOM chrome colors** in `src/overlays/search.ts`, `src/overlays/trop.ts`, `src/overlays/haftarah.ts` — migrate hardcoded `style="color: …"` greys to CSS classes that read theme vars. See the "Out of scope" list at the top of this plan for exact file:line citations.
- **Talmud route in `palette:verify`** — extend the script (or add a sibling) to capture Talmud-route screenshots per theme.

Picker UI is a separate spec, blocked on ≥2 themes clearing the promotion gate.
