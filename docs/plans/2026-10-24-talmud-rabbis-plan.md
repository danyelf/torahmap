# Talmud Rabbis Overlay Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** A "Rabbis" overlay on the Talmud map that lights every passage naming the rabbis a reader picks, each in his own colour.

**Architecture:** The facts script also writes each topic's titles. A new builder, `scripts/talmud/rabbis.ts`, turns the facts and the dating result into `public/data/talmud/rabbis.json`: the pickable rabbis (with their other names) and, for each person the dating file lists, which rabbis that name can be and whether it is certain. Which passages name a rabbi is read from `dating.json`, so the two files are loaded together and nothing is stored twice. The overlay lives in `apps/talmud/src/overlays/rabbis.ts` and shares era colours, name marking and generation labels with `dating.ts`. The shell gains one small hook, `openOverlay`, so a click on a name in a pinned passage can open the overlay with settings.

**Tech Stack:** TypeScript, vitest, Python under `uv run`.

**Spec:** `docs/plans/2026-10-24-talmud-rabbis-design.md`

## Global Constraints

- A rabbi's id is his Sefaria slug. The link key is `rabbis`, a comma-separated list of slugs; `?overlay=rabbis&rabbis=...`.
- A square shows at most four colours.
- An ambiguous name with exactly one candidate counts as that candidate, certain. With several it lights each candidate faded.
- Rabbis without a generation are left out. Candidates of an ambiguous name that have a generation are rabbis even if no passage tags them by name.
- Quick picks: the 28 most-named entries, an entry being a rabbi or a shared name. A shared name asks which.
- Regenerating must leave `dating.json` byte-identical.
- No ticket references in code. Tests state their own expected values.

## Review Focus

- Picking two rabbis of one era gives different colours; picking none gives the plain map.
- A rabbi tagged only inside an ambiguous name is faded, never solid.
- A slug in a link that is not in the data is ignored.
- More than four picked rabbis in one passage still draws four colours.
- Clicking a name that is already picked changes nothing.

## Tasks

### Task 1: Names in the facts, and the rabbis file

**Files:** modify `scripts/talmud/sefaria-dating-facts.py`, `scripts/talmud/dating.ts`; create `scripts/talmud/rabbis.ts`, `apps/talmud/src/rabbis.ts`, `scripts/talmud/__tests__/rabbis.test.ts`; modify the dating test's fixture.

**Interfaces:**
- `Facts.topics[slug].names: string[]`, every title the topic has.
- `datingFrom(facts, structure, texts, placement?, slugs?: string[])` fills `slugs` with each person's Sefaria slug, in `people` order.
- `apps/talmud/src/rabbis.ts`: `RABBIS_FILE`, `Rabbi {id, en, he, gen: string (generation code), names: string[]}`, `Reading = [sure: 0|1, ...rabbis: number[]]`, `TalmudRabbis {rabbis: Rabbi[]; readings: Reading[]}` (readings by place in `dating.people`).
- `rabbisFrom(facts, slugs): TalmudRabbis`.

- [ ] Tests: a plain person reads `[1, himself]`; an ambiguous name with two dated candidates reads `[0, a, b]`; with one candidate `[1, a]`; with two candidates of which one has no generation `[0, a]`; a candidate's names include the titles of the ambiguous names that list him; a topic without a generation is not a rabbi.
- [ ] Implement, run `npm test`, regenerate, and `cmp` the new `dating.json` against the old one.

### Task 2: Share what Dating owns

**Files:** modify `apps/talmud/src/overlays/dating.ts`.

**Interfaces:** export `ERAS`, `eraOf`, `faint`, `mix`, `markNames(text, spans, paint)`, the last being what Dating's highlight already does; Dating uses it too.

- [ ] Existing dating tests pass unchanged.

### Task 3: Settings, colours and finding (pure)

**Files:** create `apps/talmud/src/overlays/rabbiPicks.ts`, `apps/talmud/test/rabbis.test.ts`.

**Interfaces:**
- `pickColors(rabbis: Rabbi[]): Color[]`: a lone rabbi of an era gets his generation's Dating colour; several of one era get that era's dark-to-light shades spread evenly, leaning a little in hue.
- `rabbiPassages(dating, rabbis): Map<slug, {sure: Set<segment id>, maybe: Set<id>}>`.
- `suggest(query, data): Rabbi[]`: names matched in any case, most-named first; `quickPicks(data): Entry[]`.
- `parsePicks`/`writePicks` for the link.

- [ ] Tests for each: picking lights exactly the tagged passages; two picks split a shared passage; the filter matches another name ("Resh Lakish" finds Rabbi Shimon b. Lakish; "Gamliel" finds all three); the link round-trips and drops unknown slugs; two same-era picks differ.

### Task 4: The overlay and the shell hook

**Files:** create `apps/talmud/src/overlays/rabbis.ts`, `rabbis.css`; modify `apps/talmud/src/text.ts`, `packages/shell/src/app/text.ts`, `packages/shell/src/main.ts`, `packages/overlay-catalog` if the catalogue requires an entry, the Talmud credits.

**Interfaces:** `Shell.openOverlay<O>(overlay: Overlay<I, O>, update: SettingsUpdate<O>)`: if another overlay is showing, switch to it with default settings first, then apply `update`, and open its panel.

- [ ] Overlay members: colours (a list of colours for a shared passage, faded for a maybe, dimmed base for unlit, the base for none picked), `standoutsFor`, controls (finder, picked rabbis with a swatch and an unpick, quick picks, the which-one list), legend, summary, hover, pinned info with clickable names, name marking.
- [ ] Tests on colours, controls and the pinned info; typecheck.

### Task 5: Look at it, verify, review

- [ ] Screenshots of the states in the brief into `docs/plans/talmud-rabbis-shots/`; `npm run typecheck`, `npm test`, `npm run format:check`, `npm run build`, `npm run test:browser`.
- [ ] Open the PR against main, stacked on #455; fresh drift and bugs-only reviews; post `Reviewed up to <sha>`.
