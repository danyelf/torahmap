# Palette Registry: Design Spec

> Companion to [`2026-05-13-palette-exploration-design.md`](./2026-05-13-palette-exploration-design.md). The exploration doc surveys the field; this spec is the concrete architecture for making more than one palette runnable in the live app.

## Goal

Make all six viable palette candidates runnable in the dev app via a `?theme=<id>` URL param, while keeping the door open to a user-facing picker once a palette has been fully tuned across every overlay.

## Decisions made during brainstorming

| Question | Decision |
|---|---|
| Toggle audience? | Hidden URL param now; promote winners to a user-facing picker later. |
| Swap unit? | Monolithic preset. One theme = one indivisible bundle. No per-axis overrides. |
| A11y bar this round? | Deferred. A dedicated WCAG / CBF palette is a separate workstream. |
| Architecture? | **B** — core `Theme` record + per-overlay theme contributions tables. |

## Architecture (B)

A small **core Theme** record lives in `src/themes.ts`:

```ts
type ThemeId = 'refined-grey' | 'newsprint' | 'plum' | 'oxblood' | 'manuscript' | 'okabe';

interface CoreTheme {
  id: ThemeId;
  name: string;                                  // for picker labels later
  polarity: 'dark' | 'light';                    // fallback hint for un-tuned overlays
  bg: Color;                                     // WebGL clear color
  cssBg: string;                                 // body / chrome via CSS var
  dust: { min: number; max: number; tint?: Color };
  dim: number;                                   // DIM_BRIGHTNESS for non-matched
  searchHues: Color[];                           // ≥5, distinct
  outlines: {
    default: Color;
    hover: Color;
    pin: Color;
    hoverWhilePinned: Color;
  };
  chrome: {                                      // CSS custom property values
    fg: string;
    sidebarBg: string;
    sidebarFg: string;
    link: string;
  };
}

const THEMES: Record<ThemeId, CoreTheme> = { ... };
```

Theme selection happens once at module load:

```ts
function resolveThemeId(): ThemeId {
  const fromUrl = new URLSearchParams(location.search).get('theme');
  const fromStorage = localStorage.getItem('torahmap.theme');
  const candidate = fromUrl ?? fromStorage ?? 'refined-grey';
  return isThemeId(candidate) ? candidate : 'refined-grey';
}

export const currentTheme = THEMES[resolveThemeId()];
```

A swap requires a page reload — no mid-session theme change in v1. That cuts the implementation surface (no WebGL re-render plumbing, no CSS variable refresh event).

### Per-overlay theme contributions

Each data-driven overlay owns its **own** per-theme table, co-located with its render logic:

```ts
// in overlays/commentary.ts (or wherever heatmapColor lives)
const HEATMAP_BY_THEME: Partial<Record<ThemeId, ColorStop[]>> = {
  'refined-grey': [/* the shipped stops */],
  'newsprint':    [/* paper-tone empty state → deep burgundy peak */],
  // 'plum', 'oxblood', 'manuscript', 'okabe' fall back until tuned
};

const HEATMAP_FALLBACK_BY_POLARITY: Record<'dark' | 'light', ColorStop[]> = {
  dark:  [/* refined-grey’s stops */],
  light: [/* newsprint’s stops, once tuned */],
};

function heatmapStops(): ColorStop[] {
  return HEATMAP_BY_THEME[currentTheme.id]
      ?? HEATMAP_FALLBACK_BY_POLARITY[currentTheme.polarity];
}
```

This is the single load-bearing pattern. Every data-driven overlay (`commentary` heatmap, `trop`, `text-dating`, `haftarah`) follows the same shape: own table, polarity fallback. Adding a new overlay does not touch any theme. Adding a new theme requires only the core record to be runnable.

### CSS chrome via custom properties

At module load, the resolved theme writes to `:root`:

```ts
document.documentElement.style.setProperty('--bg', currentTheme.cssBg);
document.documentElement.style.setProperty('--fg', currentTheme.chrome.fg);
document.documentElement.style.setProperty('--sidebar-bg', currentTheme.chrome.sidebarBg);
// ... etc.
```

`src/styles/main.css` and chrome CSS read `var(--bg)`, `var(--fg)`, etc. This fixes the design-doc-noted duplication where body bg and WebGL clear color were maintained separately.

Chrome colors are **declared** per-theme (`currentTheme.chrome`), not derived from bg luminance. Deriving them ("light theme → dark text, dark theme → light text") is tempting but brittle: Manuscript's cream wants warm-ink chrome, Newsprint's grey-cream wants near-black chrome, and the rule "polarity decides" loses that distinction. Add `chrome: { fg, sidebarBg, sidebarFg, link }` to `CoreTheme`.

## Palette slot map

| # | Theme | Polarity | Runnable now (URL param) | Picker slot later | Role | Tuning cost remaining |
|---|---|---|---|---|---|---|
| 0 | Refined Grey (shipped) | dark | ✅ default | ✅ default | Everyday workhorse | 0 — done |
| 1 | Newsprint | light | ✅ | ✅ probable | Screenshot champion (clean/print) | High — all 4 data overlays need light-mode tuning |
| 2 | Risograph Plum | dark | ✅ | ✅ probable | Distinctive promo (art-object) | Medium |
| 3 | Oxblood Folio (new) | dark | ✅ probe | ❓ if it earns it | Thematic-dark (scholarly-object) | Medium |
| 4 | Manuscript | light | ✅ probe | ❌ unlikely | Aesthetic cousin of Newsprint; kept for A/B against it | High |
| 5 | Okabe-Ito | dark | ✅ probe | ❓ pending a11y round | Aesthetic-only this round (a11y deferred) | Medium |

Phosphor Black is out per prior feedback. Not in registry.

### Oxblood (new candidate) — concrete values

Sketched in the palette notebook (`/tmp/torahmap-palettes/index.html`, plate 06):

- bg `#1c1410` (deep coffee leather)
- dust: warm-red tint `[1.00, 0.55, 0.45]`, range 0.30–0.88 → glows oxblood → terracotta
- search hues (cool, to escape warm bg): teal `#4ecdc4`, gold `#f4d35e`, violet `#a786df`, ice-blue `#9dd9f3`, lime `#c8e87a`
- polarity `dark`

## Promotion gate (probe → picker)

A theme moves from "runnable URL probe" to "user-facing picker option" only when:

1. All 4 data-driven overlays (commentary heatmap, trop, text-dating, haftarah) have their own per-theme entry — no polarity fallback in production. Polarity fallbacks are fine for dev probes but ship muddy data overlays.
2. The theme has passed the verification protocol (below) end-to-end without dropping below MIN_BRIGHTNESS thresholds anywhere.
3. The chrome CSS reads cleanly (sidebar, controls, keyboard UI) — no hardcoded greys that fight the theme.

The picker UI itself is a separate spec, blocked on at least two themes clearing the gate.

## Verification protocol (preserved from exploration doc)

Unit tests passed at every step while the visual result was wrong on the prior pass. So for any palette change:

1. Headless screenshot via `probe.mjs` in: default state, single-term search, multi-term search, each overlay active.
2. Pixel-sample known points: a non-match verse vs bg should be ≥30 per channel delta.
3. Compare against a golden reference PNG per theme.
4. Only then update tests.

A `npm run palette:verify` script will run the probe for `?theme=<id>` and write screenshots to `docs/plans/data/palettes/<theme-id>/`. Run before any palette-related PR.

## Out of scope (deferred)

- **Picker UI.** Blocked on ≥2 themes clearing the promotion gate.
- **A11y palette (WCAG / CBF-safe).** Separate spec. Okabe-Ito's slot is aesthetic for now, not accessibility-earned.
- **Mid-session theme swap.** Reload-based v1 is good enough; no event plumbing.
- **Per-axis overrides** (e.g., "Newsprint bg + Okabe search hues"). Rejected — monolithic preset only.
- **Composability across themes.** Same as above.
- **Mobile / sunlight-readability tuning.** Bright modes happen to help here, but no specific work.

## Risks & open assumptions

- **Polarity fallback for data overlays may look bad enough to mislead.** A half-tuned probe might be rejected on the basis of an overlay's fallback, not the theme's own choices. Mitigation: probes should be evaluated with overlays *off* unless that theme's contribution is filled in.
- **`localStorage` precedence over URL param vs. opposite.** Spec says URL > storage. If a developer pins `localStorage` and then forgets, URLs will appear to do nothing. Sticking with URL precedence; document it.
- **CSS variable migration touches every chrome file.** Listing in plan: `styles/main.css`, sidebar styles, control styles, keyboard UI styles, help modal styles. Audit needed; not a small touch.
- **Polarity fallback table maintenance.** Each overlay has two fallback tables. If we forget to update them when refined-grey or newsprint's overlay tunings change, fallback drifts from the canonical theme. One mitigation: derive fallback by referencing the actual theme's entry (`HEATMAP_BY_THEME['refined-grey']`) instead of duplicating literals.
