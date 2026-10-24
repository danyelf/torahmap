# Talmud Dating Overlay Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** The Talmud map's first overlay, "Dating", colouring each segment by the generation of the
latest rabbi it names.

**Architecture:** A Python extractor reads the Sefaria dump's BSON files and writes a plain JSON of
facts (mentions, ambiguity candidates, topics, time periods). A TypeScript builder applies the
rules to those facts and writes `public/data/talmud/dating.json`. Only the builder's pure rules are
tested, on small examples; CI never runs the extractor or needs the dump. The overlay is a factory
built inside the Talmud's `open()` so it can reach the structure for the faint Mishnah/Gemara tint.
The text already takes its overlays per text (`MapText.overlays`) and the link already carries
`?overlay=<id>`, so the shell, colouring and fade paths are reused as they are.

**Tech Stack:** TypeScript, vitest, Python 3 with `pymongo` under `uv run`.

**Spec:** `docs/plans/2026-10-24-talmud-dating-design.md`

## Global Constraints

- Latest generation among the rabbis named wins; a two-generation code (A2/A3) counts as the later.
- Only mentions in the Hebrew/Aramaic text, edition `William Davidson Edition - Aramaic`.
- A segment with any resolved dated name is never uncertain; ambiguous names then add nothing.
- An uncertain segment takes its latest candidate's generation, shown paler.
- No borrowing from neighbouring segments. No-rabbi segments keep a faint tint of the base colour.
- The generator stops if a tractate's segment count differs from `public/data/talmud/texts/`, or on
  a range ref.
- Names in Hebrew and English in the pinned panel; generation labels in English.
- No ticket numbers in code; short present-tense comments.

## Review Focus

- A segment tagged only with people who have no generation is treated as naming no dated rabbi
  (test: dated nothing).
- Several tags of one person on a line (four editions) count once (test).
- A tag inside a fuller name's span is dropped from the panel (test).
- A tractate in the dump that the map lacks, and Jerusalem Talmud / Mishnah refs, are ignored (test).
- A ref with a range stops the build (test).

## Files

- Create `scripts/talmud/sefaria-dating-facts.py`: BSON to facts JSON.
- Create `scripts/talmud/dating.ts` (+ `__tests__/dating.test.ts`): rules and file writer.
- Create `apps/talmud/src/dating.ts`: data file name, shape, reading.
- Create `apps/talmud/src/overlays/dating.ts` (+ `apps/talmud/test/dating.test.ts`): the overlay.
- Modify `apps/talmud/src/text.ts`: `overlays: [datingOverlay(...)]`.
- Create `public/data/talmud/dating.json`.
- Modify the Talmud site credits for Sefaria's person data.

### Task 1: Rules and data shape

**Interfaces:**
- Produces, in `apps/talmud/src/dating.ts`: `DATING_FILE`, `interface TalmudDating { generations:
  Generation[]; people: Person[]; segments: Record<string, DatedSegment> }`, where `Generation =
  {code, name, from, to}`, `Person = {en, he, gen: number, ambiguous?: true}` (gen indexes
  `generations`), and `DatedSegment = [generation: number, uncertain: 0|1, ...people: number[]]`.
- Produces, in `scripts/talmud/dating.ts`: `datingFrom(facts: Facts, counts: Map<string, number>):
  TalmudDating`.

- [ ] Write failing tests in `scripts/talmud/__tests__/dating.test.ts`: latest generation wins; A2/A3
  counts as A3; English-only and non-Davidson tags ignored; duplicates across editions count once;
  ambiguous-only is uncertain at the latest candidate; resolved name beats ambiguous; undated person
  dates nothing; contained tag dropped from people; range ref and tractate-count mismatch throw;
  non-Bavli refs ignored.
- [ ] Run them, see them fail. Implement `datingFrom`. Run, see them pass.
- [ ] Commit.

### Task 2: Extractor and the shipped file

- [ ] Write `sefaria-dating-facts.py` (`uv run --with pymongo`), taking the extracted dump directory
  and an output path. Write `main()` in `dating.ts` reading the facts and `texts/` counts and
  writing `public/data/talmud/dating.json`.
- [ ] Run on the real dump; check the figures against the design (47,322 dated; 2,615 uncertain).
- [ ] Add a test that every key in the shipped file is a segment on the map (`talmud-data` fixture).
- [ ] Commit script and file.

### Task 3: The overlay

**Interfaces:** `datingOverlay(structure): Overlay<TalmudLayoutItem, void, {dating: TalmudDating}>`

- [ ] Failing tests: dated segments take their generation's colour, earlier generations warmer than
  later; uncertain is washed out toward grey compared with the same generation certain; an undated segment is a faint tint of
  `mishnahOrGemaraColor`; key lists only generations present with years; pinned lines show name,
  Hebrew name and generation, and say when a name is uncertain.
- [ ] Implement `renderLegend`, `renderSidebarInfo`, `summary`, `getItemColor`, `colorsFor`.
- [ ] Wire into `text.ts`; add a credit for Sefaria's person data.
- [ ] Run typecheck, tests, format, build. Commit.

### Task 4: Browser check and PR

- [ ] `npm run test:browser`; load `?overlay=dating`, check colours, key, pinned panel, zoom
  0.25 and 0.22 for moire; capture screenshots; read some PNGs.
- [ ] Push, open the PR, wait for the preview link, comment on the issue, get a review.
