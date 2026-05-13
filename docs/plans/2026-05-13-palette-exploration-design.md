# Palette Exploration: Concept & Plan

## Context

The current dark grey-on-grey palette has two contrast problems: verse dust sits within ~25% luminance of the background, and the five search hues (cyan, orange, lime, pink, yellow) cluster in adjacent regions of chroma-luminance space and shimmer into each other when scanning. The `higher-contrast` branch landed a first revision: brighter dust (0.50–0.92), refined hues, uniform `DIM_BRIGHTNESS` for non-matched verses during search. This document plans the broader exploration.

## Goal

Make palette swaps **cheap to try and safe to ship**. Today, swapping a palette requires editing ≥5 files across overlays, constants, CSS, and the WebGL clear color, with subtle interactions that unit tests can't catch.

## Current State (post `higher-contrast`)

**Centralized:** `HIGHLIGHT_CONSTANTS` in `src/constants.ts` (background, dust brightness, dim brightness, hover/pin outlines), `SEARCH_COLORS` in `src/utils/color.ts`, canvas clear color routed through `CANVAS_BG_COLOR`.

**Still decentralized:**

| File | Owns | Tied to dark bg? |
|---|---|---|
| `src/styles/main.css` | `body { background }` — must match `CANVAS_BG_COLOR` | yes — duplicated value |
| `src/utils/color.ts` | `heatmapColor()` 5-stop gradient (commentary overlay) | yes — dark blue → red |
| `src/overlays/trop.ts` | 6 hardcoded purple/magenta gradient stops + RARE_MATCH_COLOR | yes — assumes dark bg |
| `src/overlays/text-dating.ts` | 6 hardcoded era colors (red-brown → cream) | yes — cream invisible on light bg |
| `src/overlays/haftarah.ts` | Uses HSL desaturation (`DESATURATE_FACTOR`) — palette-agnostic in principle | partially |
| `src/styles/*.css` (chrome) | Sidebar, controls, keyboard UI — many hardcoded greys / link blues | yes |

**Key insight:** any "true theme system" must let each overlay declare both light-mode and dark-mode color choices. The data-driven overlays (commentary heatmap, text-dating eras) were each hand-tuned for a dark bg; on a light bg, their pale colors disappear.

## Candidate Palettes

From the design notebook at `/tmp/torahmap-palettes/` (and the [original sketches](#)). Each is a complete answer, not a tweak. Each needs a spec across 4 layers: **background**, **dust**, **search hues**, **overlay overrides**.

| # | Name | Bg | Dust range | Search hues | Strength | Cost |
|---|---|---|---|---|---|---|
| 0 | Refined Grey (shipped) | `#1a1a1a` | 0.50–0.92 | cyan/orange/green/magenta/yellow | minimal disruption | none |
| 1 | Newsprint Inverse | `#f4efe6` | graphite 0.10–0.42 | vermillion/lapis/verdigris/imperial/ochre | most screenshot-friendly; only one printable on paper | all overlays need light-mode variants |
| 2 | Phosphor Black | `#000000` | navy→white 0.18–0.95 | CRT phosphors at max chroma | refuses to blend on the retina | jarring; overlay re-tune needed |
| 3 | Illuminated Manuscript | `#f2e7c8` | sepia 0.18–0.50 | medieval pigments | most thematic | same as Newsprint, plus tints |
| 4 | Okabe-Ito (corrected) | `#0a1020` (deep navy) | indigo→white 0.30–0.85 | colorblind-universal palette | accessibility win | scientific feel; needs hue-cast for dust |
| 5 | Risograph Plum | `#1e1429` | warm-cream 0.55–0.92 | fluoro pink/federal/mint/marigold/teal | reject grey/grey entirely | most distinctive; biggest break from current |

Newsprint is the natural "Bright Mode" candidate. Plum and Okabe-Ito are the strongest dark-mode contenders. Phosphor is out per your feedback.

## Three Tiers of Investment

### Tier 1 — Static one-off probes (~1 hr each)

For each palette: clone branch, swap the centralized constants, accept that data-driven overlays are off-tune. Screenshot, evaluate, discard or promote. **This is what we did for Okabe.** Cheap; lets us A/B quickly.

**Output:** screenshots and a verdict, not merged code.

### Tier 2 — Theme registry, no toggle (~3-4 hrs)

Introduce `src/themes.ts` with a `Theme` interface:

```ts
interface Theme {
  id: string;
  name: string;
  bg: Color;
  dust: { min: number; range: number; tint?: Color };
  dim: number; // DIM_BRIGHTNESS
  searchHues: Color[];
  outlines: { default: Color; hover: Color; pin: Color; hoverWhilePinned: Color };
  overlays: {
    heatmap: ColorStop[];      // commentary
    trop: { gradient: ColorStop[]; rareMatch: Color; noMatch: Color };
    textDating: Color[];        // 6 era colors
    haftarahDesaturate: number;
  };
}
```

Pick ONE theme at module load — e.g. via env var, build flag, or URL param. All overlays and rendering pull from `currentTheme`. No runtime switching.

**Effort:** mostly mechanical refactor. The non-mechanical part is hand-tuning the overlay color sets for each candidate.

**Output:** 2-3 themes shipped in code; default unchanged.

### Tier 3 — Runtime toggle + persistence (+2 hrs on top of Tier 2)

- Picker UI (segmented control or dropdown in `#controls`)
- Persist choice in `localStorage` under `torahmap.theme`
- URL param `?theme=newsprint` overrides
- Theme-change event triggers WebGL re-render + CSS variable refresh
- CSS chrome (sidebar, keyboard, controls) becomes CSS-variable-driven so the body and overlays both swap atomically

**Output:** user-facing palette picker. "Bright Mode" toggle is a special case of this.

## Per-Overlay Re-Tuning (the hidden cost)

For any **light-mode** theme (Newsprint, Manuscript), every data-driven overlay needs a fresh gradient. Concretely:

- **Commentary heatmap**: dark-blue → red on dark bg becomes pale-blue → deep-red on cream. Currently `[0.1, 0.13, 0.18]` (near-black) is the empty-state — invisible on dark bg, stark on light. Needs to flip to `[0.92, 0.88, 0.78]` (paper-tone) for Newsprint.
- **Trop palette**: 6 purple/magenta stops. Light-mode equivalent is darker purples, more saturated.
- **Text-dating eras**: the cream/beige newest layer `[0.80, 0.80, 0.70]` is the worst offender — disappears on cream bg.
- **Haftarah desaturation**: HSL-based, so probably palette-agnostic. Verify.

Each overlay: ~30 min to hand-tune + verify visually. Five overlays × 2 modes (light + dark) = ~5 hrs of re-tuning if we ship both light and dark trees.

## Verification Protocol (lesson from today)

Unit tests passed at every step today while the visual result was wrong. New rule for palette changes:

1. **Headless screenshot before claiming done.** Use `probe.mjs` (already on this branch) as the basis. Take screenshots in: default state, single-term search, multi-term search, each overlay active.
2. **Pixel-sample known points.** Sample a known-non-match verse and the bg; confirm delta > 30 per channel.
3. **Compare side-by-side** with a reference (a "golden" PNG for the shipped theme).
4. **Only then update tests** to match.

Codify this as a script: `npm run palette:verify` that runs `probe.mjs` and writes screenshots to a known location. Run before any palette PR.

## Open Questions

1. **One light mode or many?** Newsprint vs Manuscript are aesthetically distinct but both light. Pick one, or ship both?
2. **Toggle UI vs Picker UI?** A two-state toggle (dark/light) is simpler but limits us; a picker lets us ship Plum and Okabe alongside without expanding the toggle into a select.
3. **URL param vs `localStorage`?** URL wins for shareability ("look at this screenshot in Newsprint"), `localStorage` wins for personal preference. Probably both, with URL precedence.
4. **Per-overlay theme overrides?** Could the user pin "Newsprint base + Okabe search hues"? Probably out of scope, but the registry shape should not preclude it.
5. **High-contrast accessibility mode?** Separate concern from aesthetics. WCAG AAA needs 7:1 contrast — none of the candidates hit this for dust on bg. Worth a separate dedicated theme.
6. **Mobile?** Are colors readable in sunlight? The current dark theme is hostile outdoors. Bright mode pulls double duty here.

## Risks / Lessons from this session

- **WebGL clear color is invisible until you look for it.** Any theme work must check `gl.clearColor` calls.
- **CSS body bg and canvas clear color must always match.** Today they're duplicated in two files. The theme registry should derive the CSS body bg from `CANVAS_BG_COLOR` via a CSS variable.
- **Hardcoded literals in tests rot fast.** Today: ≥10 test assertions pinned to specific RGB values across 4 test files. Future test guideline: **assert through the constant, not its current value.** Already applied in `verseColoring.test.ts`, `search.test.ts`, `search-overlay-modes.test.ts`, `rendering.test.ts` on this branch.
- **Overlays each invented their own dim/default formula.** The `search.ts` dim formula bypassed both `MIN_BRIGHTNESS` and `VERSE_TINT`. Lesson: any "default-ish color" inside an overlay should call a shared helper (`getDimmedDefaultColor()`), not invent its own arithmetic.

## Concrete Next Steps (in priority order)

1. **Land** `higher-contrast` to main as the shipped baseline (Tier 0 refined grey). Open issue for follow-ups.
2. **Tier 1 probes** for the three strongest candidates: Newsprint, Plum, Okabe-Ito (already exists as a discarded branch). One worktree each, screenshots saved to `docs/plans/data/palettes/`. Goal: gut-check which palette to invest in.
3. **File a follow-up issue: "Centralize theme tokens"** — Tier 2 refactor. Decide based on Tier 1 results whether the cost is justified (likely yes if we want any light mode).
4. **File a follow-up issue: "Bright mode toggle"** — Tier 3 implementation, gated on Tier 2.
5. **Codify `npm run palette:verify`** — make the screenshot probe a first-class workflow before the next palette PR.

## Out of Scope

- Color-theming the data-driven overlays (commentary heatmap, etc.) beyond what each candidate palette requires.
- Accessibility-grade contrast modes (WCAG AAA / colorblind-specific). Separate workstream.
- Print-optimized export. Newsprint covers this incidentally; a dedicated print mode would be a separate ask.
