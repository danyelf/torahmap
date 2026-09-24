# Handoff: the interface's information hierarchy

**Date:** 2026-09-23
**Status:** Designed and planned; nothing built.

Read this first, then the design. It records where the work stands and what was
decided in conversation that the documents below do not say on their own.

## The documents

| document | what it is |
|---|---|
| `2026-09-23-ui-information-hierarchy-design.md` | The design. Settled with Danyel over several rounds of mockups. The picture at its top is the target. |
| `2026-09-23-layout-tests-implementation.md` | Plan: a Playwright suite that checks layout rules at four screen sizes and writes a contact sheet. Its own branch, off `main`. |
| `2026-09-23-ui-frame-implementation.md` | Plan: step 1 of the design, "the frame". Its own branch, off the design branch. |

The design's order of work has four steps. Only the first has a plan. Search
as its own tool, Share, and more than one story come after, each its own
branch and its own look from Danyel.

## Branches

- `worktree-ui-information-hierarchy` — the design, the two plans and this
  note. Worktree at `.claude/worktrees/ui-information-hierarchy`. Docs only.
- `layout-tests` — not yet created. The layout-tests plan creates it off
  `origin/main`.
- `ui-frame` — not yet created. The frame plan creates it off the design
  branch.

The two plans can run at the same time. The frame plan needs the layout
tests only in its Task 5, and says to stop and open a draft PR if they have
not merged by then.

## Decided in conversation, and where it is written

- **Stories are a mode, not a drawer**, with no exit button. Moving the map
  mid-story borrows the camera and is not leaving; leaving is choosing a tool
  from the menu, or the story's last stop. *(Design, "The shape".)*
- **The menu drops into the story's own column**, not over the map, with the
  current stop still visible and dimmed below it. "Continue the story" is its
  first item. Danyel rejected a menu that floated over the map as using new
  space instead of the panel's. *(Design.)*
- **The corner button is a plain ☰.** A ת was considered and dropped: it
  does not say "menu" to anyone who does not read Hebrew.
- **Search leaves the overlay list** and becomes a tool of its own; hits take
  the fill and the overlay stays behind them, dimmed. A "dim everything else"
  switch may come later. Ringing each hit was rejected because ring thickness
  is in map units and vanishes when zoomed out. *(Design, "Search and an
  overlay together".)*
- **Desktop has an icon rail; a phone has a top bar that hides while the map
  moves and a bottom sheet.** Danyel found a full-width top bar too much on a
  desktop. *(Design, "The two layouts".)*
- **Anything on but not open folds to a labelled line at the bottom edge of
  the panel**, on both sizes, and opens in place. Danyel was torn between this
  and putting the line under the map; this won because the line never travels
  across the screen when opened. *(Design.)*
- **The help window dissolves into an About panel**; its Overlays tab goes.
  *(Design, "How this lands in the code today".)*
- **The phone's sheet** is as tall as what is open, capped at half the screen,
  with a drag to full, and a constant height during a story. *(Design.)*
- **The verse popup and the zoom buttons stay as they are.** *(Design.)*
- **The rail and the panel go on the left**, as the mockups drew them —
  Danyel's decision on 2026-09-24. The map therefore needs its own origin:
  the frame plan, as amended on the `ui-frame` branch, adds a task that
  measures every pointer from the canvas's corner before the panel moves.
- **The URL** will carry a search and an overlay side by side, and a story and
  its stop. Danyel's `story=<name>&stop=<id>` and `search=<terms>&overlay=<id>`
  were an approximation; the key names are not settled. *(Design.)*
- **Layout is the product, so layout gets real tests.** Danyel's words: "This
  project is ABOUT layout, the goal is good layout." Hence the Playwright
  plan, landing before the frame, and screen sizes cut to four: desktop,
  laptop, tablet, iPhone 13.

## Open, for Danyel

- **The rail's icons** are placeholders. Danyel wants them clean and
  thematically right; they are a design task of their own.
- **When the phone's top bar comes back** after hiding. The plan uses 2
  seconds after the map stops.
- **What the Stories panel calls the one story** until stories have titles.
  The plan uses "The guided tour".
- **The failures the layout tests find in today's interface**, which Danyel
  reviews before any enters `layout/known.ts`.

## Facts found along the way

- Playwright is a bare devDependency used by three hand-run scripts; there is
  no test runner, no config and no CI. Headless WebGL works with SwiftShader
  flags, as `scripts/og-image.mjs` does it.
- The palette work that once ran Playwright assertions (`palette:assert`) is
  not on `main`.
- The canvas clears to `#1a1a1a`, the page's own background, so a blank map
  and a missing one look the same; the layout tests count coloured pixels.
- SBL Hebrew is not a web font; only David Libre loads, from Google Fonts.
- The mockups from the design sessions are throwaway HTML in a session
  scratch directory that will not outlive the session; the design's embedded
  picture is the record.
