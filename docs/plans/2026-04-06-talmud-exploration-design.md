# Talmud Engine Exploration — Design

**Issue:** tm-7la
**Date:** 2026-04-06
**Status:** Closed — exploration complete (see memo at `2026-04-06-talmud-exploration-memo.md`)

> **Note (added at landing):** This document was written as the design plan for an exploration issue. The terminology and structure reflect the planning state, not the final outcome. The exploration's actual conclusions and the as-built design are in the memo. The Phase-0 reconnaissance findings and key technical decisions captured below are still accurate; only the deliverables and follow-up sections were superseded by the memo.

## Goal

Answer the question: *can the Torah Map's WebGL visualization engine be adapted for the Talmud?* with enough evidence to make a confident yes / no / yes-with-caveats decision before committing to an integration effort.

This is an exploration bead. The deliverable is understanding, not a shipped feature.

## Deliverables

Two artifacts, both committed to the `tm-7la` branch:

1. **Memo:** `docs/plans/2026-04-06-talmud-exploration-memo.md` — written analysis, embedded screenshots, recommendation, follow-up beads.
2. **Prototype:** `scripts/talmud-prototype/` — standalone throwaway script that produces `berakhot.svg`. Not integrated with the main app. Not reusing `src/layout.ts`.

## Scope

- **Tractate:** Berakhot only (2,749 segments). One tractate is enough to answer the layout-metaphor question; full-Bavli scaling is a follow-up bead.
- **Atom:** Sefaria segment. The Sefaria-Export Talmud JSON is structured as `text[amudIndex][segmentIndex]` with `sectionNames: ["Daf", "Line"]` — i.e. daf/amud is the natural array layer, NOT perek. The parser must reshape this into perek-grouped segments using perek boundaries from the schema file (see §4 below). Each segment carries its `(perek, daf, amud, segmentInPerek)` coordinates and a Mishnah/Gemara tag.
- **Output medium:** static SVG. The prototype's job is to test layout and color, not rendering.

### Out of scope

- Yerushalmi, Tosefta, Mishnah-as-its-own-corpus.
- Any change to the main app (`src/`).
- Sugya boundary inference.
- Hebrew/Aramaic classification (deferred — see follow-ups).
- Refactoring or sharing code with `src/layout.ts`.
- Live Sefaria API calls.

## Key decisions and reasoning

### 1. Atom = Sefaria segment

The Talmud has no native "verse" — daf and amud are typesetting artifacts, sugya is semantic but unmarked. Sefaria segments are the only unit with stable IDs across the corpus, the closest analog to Tanakh verses, and ~150k–200k for full Bavli is well within the WebGL budget the engine already handles.

### 2. Layout = perek-primary, daf as visible sub-cluster

Each perek is a row, segments flow right-to-left within the row, ragged left edge encodes perek length in segments. Within a perek row, segments are grouped into **daf-cluster sub-blocks** with hairline gaps between dapim, and floating daf labels (e.g., "17a") above each cluster for navigation.

This was chosen over a daf-primary grid because:

- The Tanakh map's whole thesis is *"ragged edge of a row encodes the natural length of a unit of thought."* Perek is the closest Talmud analog to a Tanakh chapter; daf is not (a daf is where the printer's leaf ended). Daf-primary throws this signal away.
- Perek-primary preserves both navigations: perek shape from row geometry, daf lookup from sub-cluster gaps and floating labels.
- The Mishnah/Gemara distinction is much more legible per-row: each perek opens with a short bold Mishnah block, then a long Gemara tail.
- Daf-primary's main advantage is matching the printed Vilna page, but that's not the visualization's job — Sefaria's reader already does that.

### 3. Visual encoding

- **Mishnah segments:** rendered with a distinct visual treatment (likely a darker fill or border) on top of whatever overlay color is active.
- **Gemara segments:** base color.
- **Overlay (one only, for the prototype):** segment **character count**, mapped to a sequential color ramp (short = pale, long = saturated).

Segment length was chosen as the prototype overlay because it is (1) unambiguous to compute — just count characters, no linguistic claims — and (2) likely to surface real Talmudic texture (terse halakhic back-and-forth vs long aggadic digressions and derashot). It tests the *analytical-substrate thesis* of the Tanakh map (patterns visible across a stable spatial arrangement) without pretending to measure a signal we don't actually have.

A Hebrew/Aramaic ratio overlay was considered and rejected: any cheap heuristic (nikud presence, particle frequency) would effectively just rediscover the Mishnah/Gemara split that's already shown structurally. A proper Hebrew/Aramaic classifier is its own research project and is filed as a follow-up.

**Mishnah/Gemara tagging mechanism.** The Wikisource Hebrew text embeds traditional `מתני׳` (matnitin = "our Mishnah") and `גמ׳` (gemara) delimiters at the start of each block. The parser walks the daf/segment array in document order, tracking a `currentKind` state variable; whenever a segment begins with (or contains) `מתני׳` it flips to `mishnah`, and whenever it contains `גמ׳` it flips to `gemara`. Each segment is then tagged with `currentKind`. Validated against Berakhot: 34 `מתני׳` markers, 34 `גמ׳` markers, and 9 `הדרן` markers (perek-end formula) at exactly the standard Vilna perek boundaries. No heuristic; no live API calls.

### 4. Data source = Sefaria-Export GCS bucket (cached)

The prototype loads cached JSON from the public GCS bucket backing [Sefaria/Sefaria-Export](https://github.com/Sefaria/Sefaria-Export). The GitHub repo itself is just an index — the actual ~26 GB of JSON lives at `gs://sefaria-export/` and downloads without auth.

Two files needed:

1. **Hebrew text:** `https://storage.googleapis.com/sefaria-export/json/Talmud/Bavli/Seder%20Zeraim/Berakhot/Hebrew/Wikisource%20Talmud%20Bavli.json` (663 KB).
2. **Schema:** `https://storage.googleapis.com/sefaria-export/schemas/Berakhot.json` (51 KB), used for perek boundaries.

Other details:

- Cache lives at `scripts/talmud-prototype/cache/`, worktree-local and committed.
- A `fetch.ts` downloads both files once, idempotently.
- **Wikisource is chosen over the Davidson vocalized "merged" version** because Davidson's editorial process partially stripped the traditional `מתני׳` (matnitin) and `גמ׳` (gemara) delimiters, which we need for clean Mishnah/Gemara tagging. Wikisource preserves them. Empirically Wikisource has the *same* number of amudim and the *same* number of segments per amud as Davidson for Berakhot (zero mismatches; 2,749 segments either way), so position-based addressing is interchangeable. Wikisource lacks vocalization (nikud), which doesn't matter for the prototype since we render colored squares, not text.
- **Risk for full Bavli:** Wikisource may be incomplete on other tractates. The memo's recommendation section will flag "verify Wikisource coverage per tractate" as a precondition for the integration bead.

### 5. Layout function shape

`computeTalmudLayout(tractate: TalmudData) → VerseLayout[]`

Same return shape as `computeLayout` in `src/layout.ts`, so the eventual integration (step C) is mostly "wire it up" rather than "rewrite it." But the function is *not* shared with `src/layout.ts` — Talmud and Tanakh structures are different enough that abstracting now is premature. The duplication is intentional and throwaway.

## Memo contents

The memo at `docs/plans/2026-04-06-talmud-exploration-memo.md` will cover:

1. **Talmud structure summary** — seder / tractate / perek / daf / amud / segment, what Sefaria gives us, what it doesn't.
2. **Layout decision and reasoning** — perek-vs-daf trade-off, condensed from this design's section 2.
3. **Embedded screenshots** of the SVG (whole tractate, zoom on one perek, zoom on a Mishnah/Gemara transition).
4. **What the prototype reveals** — does perek-row geometry actually look meaningful at a glance? Does the segment-length overlay show sugya texture?
5. **Recommendation:** yes / no / yes-with-caveats on pursuing engine integration for full Bavli.
6. **Follow-up beads to file:**
   - Engine integration for full Bavli (the C-step).
   - Hebrew/Aramaic classifier overlay.
   - Multi-tractate / Seder layout question (analog of Tanakh sections).
   - Mishnah-as-standalone-corpus question.
   - Commentary-link-count overlay (Sefaria links API; analog of the existing Tanakh commentary heatmap).

## Success criteria

- The SVG renders without errors and visually distinguishes Mishnah from Gemara.
- A reader unfamiliar with the project can look at the SVG and identify perek boundaries and at least one daf number.
- The memo states a clear recommendation, supported by the screenshots.
- All follow-up issues are filed under `issues/open/` before this issue is closed.

## Risks and unknowns

- **Mishnah/Gemara tagging in Sefaria-Export.** ~~Not yet confirmed.~~ **Resolved during reconnaissance:** the Wikisource Hebrew version embeds `מתני׳`/`גמ׳`/`הדרן` markers in the segment text. Parser walks the array tracking current kind. No heuristic; no API call.
- **Wikisource coverage on other tractates.** Verified complete for Berakhot. Status unknown for the rest of Bavli. Out of scope for tm-7la; flagged as a precondition for the integration follow-up bead.
- **Segment-length distribution.** If most segments are roughly the same length, the overlay will be visually flat and the prototype will fail to demonstrate the analytical-substrate thesis. The memo should report on this honestly even if the result is negative.
- **Ragged-edge legibility at 9 rows.** Berakhot has only 9 perakim. With so few rows, the "ragged edge encodes length" pattern may not pop the way it does on a full Tanakh. Worth flagging in the memo as a reason to also look at a longer tractate before committing to integration.
