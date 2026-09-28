# Handoff: the interface redesign, after steps 1, 2 and 4

**Date:** 2026-09-27
**Status:** Steps 1, 2 and 4 merged. Step 3, sharing a view, is next and not started.

Read this first. It says where the redesign stands, what was decided in
conversation that the documents do not say on their own, and what to settle
before step 3. It replaces `2026-09-23-ui-hierarchy-handoff.md`.

## Where it stands

| Step | What | PR | Spec | Plan |
|---|---|---|---|---|
| — | Layout tests | #253 | — | `2026-09-23-layout-tests-implementation.md` |
| 1 | The frame | #251 | `2026-09-23-ui-information-hierarchy-design.md` | `2026-09-23-ui-frame-implementation.md` |
| 2 | Search as a tool | #266 | `2026-09-27-search-as-a-tool.md` | `2026-09-27-search-as-a-tool-plan.md` |
| 4 | More than one story | #265 | `2026-09-27-multiple-stories.md` | — |
| 3 | Share this view | — | the design's "Sharing a view" | — |

The design document is still the map, but the frame changed shape after it was
written; its sections carry the later decisions, with the mockups behind them.

## What a reader sees now

- **One column beside the map in both modes**, headed by a single ☰ fixed at
  the top-left. In a story the header holds the story's progress bar; exploring,
  the open tool's name. There is no rail.
- **The ☰ always drops the same menu**, over the column on a desktop and from
  the corner on a phone: *Torahmap*, Continue \<story\>, Search, Overlays,
  Stories, About & settings. It is never a panel.
- **The legend lives on the map**: one row per tool that is on, Search first,
  each opening its panel. Top-left of the map on a desktop; at the map's
  bottom edge, above the sheet, on a phone.
- **A phone** has no top bar, only the floating ☰. In a story its sheet is only
  the story's text; exploring, the sheet appears only when a tool is open.
- **Search and an overlay together**: a match over an overlay is a ring in its
  search colour around the overlay's colour, or a whole square when too small
  on screen for a hole. Verses the search doesn't match dim to 0.45 only while
  search is *in front*: the last-opened of the Search and Overlay panels.
  Tapping a legend row switches which one leads, cross-fading over 250ms.
- **Stories** live in `src/stories/*.md`, each with its own title, description,
  order and draft flag; the link names the story and the stop.

## Decided in conversation

Each is written into the document named; the reasoning is there.

- **The rail went.** It offered the same tools as the menu, and beside it the
  menu was a panel while exploring but a dropdown in a story. Once the legend
  opened the tools that are on, the rail's only job was listing tools, which
  the menu does. *(Design, "The two layouts".)*
- **The legend is on the map**, not a folded line at the bottom of the panel;
  that line read as out of place and couldn't be pressed. Danyel: "A is
  definitely more right." *(Design, "The shape".)*
- **One ☰ button** placed by CSS, not three shown in turn. *(Commit history of
  #251.)*
- **A visible hairline** where the panel meets the map, because the story's
  background is nearly the map's own. *(`--edge` in `src/styles/frame.css`.)*
- **Rings over the overlay**, reversing the design's early rejection of rings:
  widths in screen pixels plus the whole-square fall-back answer the reason
  they were rejected. *(Search spec.)*
- **Dimming only while search leads**, so a reader can see the overlay at full
  strength without clearing the search. Danyel chose "most recent open" as the
  rule, and the legend as the switch. *(Search spec.)*
- **Every animated change to the map goes through the renderer's whole-picture
  cross-fade**, the one story stops use (#260). Danyel: "any future transitions
  that we build should also use that machinery — that's what it's for."
  *(CLAUDE.md, Key Concepts.)*
- **One panel builder** (`src/panel.ts`) builds every panel, and a control
  panels share has one implementation, drawn exactly as the one it replaced.
  "Consistent with the current panels" meant *don't reimplement the ×*, not
  *make every control 44px*. *(Search plan, Decision 23.)*
- **The verse popup shows both tools' marks**; where they mark the same word,
  search wins. *(Search plan, Decision 12.)*
- **History:** turning a tool on or off adds a Back step; editing it doesn't.
  *(Search spec.)*
- **Old `overlay=search` links** are not translated; they open with no search.
- **Layout tests check layout only**: 24px touch targets (WCAG 2.2 AA), a
  deliberate ellipsis is not clipping, and no colour checks beyond "the map
  drew". *(`layout/README.md`.)*

## Step 3: sharing a view

The design says: "Share this view" in the menu copies a link to exactly what is
on screen; on a phone it opens the system share sheet; inside a story it
shares the stop. The URL already carries the overlay and its settings, the
search, the pinned verse, the camera, and the story and stop, so the work is a
control, a copy, and a confirmation.

To settle with Danyel before writing a spec:

- **Where the control lives.** A menu item is the design's answer; whether it
  also belongs somewhere always visible (the legend, the popup) is open.
- **The confirmation.** "Link copied" needs somewhere to appear, and it is new
  UI: a toast would be the first transient element in the frame. If it
  animates, it goes through the cross-fade rule above only if it touches the
  map; UI chrome is separate.
- **Inside a story.** Does a shared link open the story at that stop, or the
  map as it looks there? #204 (pinning a verse in the story writes an Explore
  link) is related; check whether it still holds.
- **The preview image** a shared link shows in chat apps (#245). In scope, or
  its own step?
- **Telemetry**: a share event, and what it records.

## Open, not blocking step 3

- #257 Hide Hebrew leaves the Hebrew line in the map title.
- #270 The story's "more below" arrow overlaps the next stop's first line.
- #271 Small search leftovers from #266's reviews.
- "Overlay" appears twice on a phone: the panel's title above the picker's own
  label. Seen by Danyel; not filed.
- #236 and #237 (phone UI, overlay notes) were addressed by #251 and may be
  closable. #225 and #230 (centring and story positions) predate the
  camera-centre change (#259) and may be fixed by it; check.
- The design's two open questions: a "dim everything that doesn't match"
  switch, and whether desktop search results deserve more room than the
  380px column.

## How the work went well

- **Mockups on the real build.** Inject the candidate CSS and markup into the
  running app with Playwright, screenshot each state, and open an HTML page of
  them side by side. Danyel judges pictures, not descriptions; every layout
  decision above was made that way.
- **Say the reading back.** When an answer is short and could mean two
  changes, state the reading being acted on in one line before it goes into a
  plan. The 44px misreading cost a plan revision.
- **Subagent-driven execution** with a fresh reviewer per task and a
  whole-branch review found real bugs every time (a stale fade painting over
  the story; Tab no longer reaching the menu; a history entry missing).
- **PRs carry layout shots** by commit-pinned URL, and a "Look at" list for
  the `workers.dev` preview. Danyel checks the phone himself.

## Environment facts

- Headless Chromium draws the map with software WebGL (SwiftShader flags; see
  `layout/playwright.config.ts`). It is too slow to show a 250ms animation:
  one click takes longer than the whole fade.
- The browser-automation tab is hidden, which stops `requestAnimationFrame`;
  animation there can only be checked by instrumenting it, not by eye.
- A new `git worktree add` has no `node_modules`; run `npm ci` before the first
  commit, or the pre-commit typecheck fails.
- The global commit hook (`~/.claude/hooks/pre-commit-build-check.sh`) now
  typechecks the repository a commit targets (a `cd <dir> &&` or `git -C
  <dir>` in the command), not the session's working directory.
