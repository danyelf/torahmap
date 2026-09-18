# Story Panel Clean-up

**Date:** 2026-09-18
**Status:** To do, before PR #198 leaves draft. Written to hand over to a fresh session.

## Where things stand

PR #198 (branch `worktree-story-panel-design`, worktree
`.claude/worktrees/story-panel-design`) builds the story panel described in
`2026-09-17-story-panel-design.md`, plus phone work that grew out of testing
on a real phone:

- The phone sheet is 30svh, and the map is the rest of the screen.
- Touching the map lowers the sheet to its summary line.
- Stops sit side by side, and a swipe moves one.
- Each new stop eases in over 1.5s (`SWIPE_EASE_MS`).
- A folded story on a phone is reopened from "Return to story" in the footer.
- "No overlay" fades out while the story drives with no overlay on.
- The story centres verses 40% of the way down the map (`PHONE_STORY_FOCUS`).
- A "more story" cue: a down chevron on desktop, a tall bracket on a phone.

Every commit passes the hook (1823 tests). Danyel has approved the look and
feel on his phone.

Two independent reviews of the diff against main found no crashes, but a
good deal of logic done in more than one place, which is the root of every
real bug they found. Danyel's priority is removing that duplication. The
findings below were confirmed by reading the code. Line numbers drift, so
search for the names.

## The clean-up, in five parts

**a. One record of "the map is between two states."** `transition` (the
story's scroll blend) and `rejoin` (the timed ease, used both for handing the
map back and for a phone swipe) mean the same thing. `repaint()`, which runs
on every hover, only knows `transition`, so hovering during an ease flashes
the overlay for a frame. `driver`, `rejoin` and `transition` are set together
by hand in about seven places; set `driver` without `rejoin` and the ease is
skipped and the map cuts. `beginSwipe` and `beginRejoin` are near-copies, and
"colours partway through the ease" is written twice. Fix: put the ease's
endpoints in the `rejoining` case of `Driver` (`driver.ts`), have one
begin-ease function, and have one value that `repaint` and `paintStoryFrame`
both read. Also have a new ease cancel `animateCameraTo`'s glide
(`cancelCameraGlide`); today the two animations can fight.

**b. One redraw point for overlay changes.** `renderOverlayUi` and
`changeSettings` each list legend, controls, summary and popup separately.
`updateSummaryShown` is called from five places. The summary line gets search
colours by reading swatches off the page (`drawnColors`,
`panelSummary.ts`), not from the search settings. A one-letter search word
is dropped from the search but its swatch is still drawn, so the other words
take the wrong colours. Fix: one `overlayChanged()`; build the summary, and
whether it is shown, from settings and state rather than from the page.

**c. One way to open the story, and one record of where it is.** The story is
opened by `openStory` (which waits for the story to finish growing, cancelled
by nothing) and directly by `applyViewState` (which does not wait). So Back
or Forward into a story link while it is folded lands on the wrong stop, and
unfolding then folding within about 250ms loses the reader's place. The
position is stored three times: `foldedPosition`, `driver.lastScrollTop`,
and the live scroll. Crossing 768px mid-session mixes the axes (vertical on
desktop, sideways on a phone), so the reader's view is eased away and a
folded story reopens on the wrong page. Fix: one open path with one
cancellable pending start; store the position as a stop index; have the
width-change handler not count its own scroll as the reader's.

**d. One writer for the URL.** About twelve places write it:
`saveUrlState`, `debouncedSaveUrlState` (300ms) and `updateUrl({story})`
on every story frame. Whoever writes last wins. `takeOver` pushes a history
entry with no story stop, and a URL with no stop means "controls open"
(`viewState.ts`), so Back or reload after dragging the map folds a story the
reader never folded. One click also adds two history entries (`takeOver`,
then `pinVerse` or `setOverlay`). Fix: one `syncUrl()` that decides between
a story URL and a controls URL from `driver` and `storyOpen`, called once
per settled change, and put "story open" into the URL so `AppMode`
(`viewState.ts`) stops guessing it. Do this together with (c).

**e. One source for the breakpoint, timing, and centre point.**
- **Reduced motion is ignored on phones.** The phone block of
  `right-panel.css` restates the panel's `transition` after the
  reduced-motion rule, and wins. Put every duration behind one variable that
  reduced motion sets to 0ms.
- **The 768px breakpoint appears five times:** `matchMedia` in `main.ts`,
  and `@media` in `right-panel.css`, `verse-popup.css`, `zoom-buttons.css`
  and `overlays/search.css`. The JS picks the story's axis by its own check
  while the CSS lays the stops out. Take the axis from the story's computed
  layout instead. Define `--sheet-shown` at `:root`: `verse-popup.css`
  relies on a variable only `right-panel.css` defines.
- **The 400ms fallback in `openStory` silently depends on the 250ms
  `--accordion-duration`.** Derive the fallback from the duration.
- **Two ideas of the map's centre.** The story places a verse against the
  canvas (`storyFocus`, `cameraForVerse`), while `centerOnVerse`,
  `glideToVerse` and a link's verse (`cameraForView`) use the whole window.
  They are 190px apart on desktop, and a phone search result lands behind the
  sheet. Use one function for where a verse sits.
- **`--sheet-bar: 60px` is a hand-measured copy of the summary line's
  height.** Derive one from the other.

## Also found

- **Phone, no-overlay stop:** a tap on empty map lowers the sheet and shows
  the summary line, but doesn't take the map. So tapping the line raises the
  sheet and hides it again. Only a drag or a verse tap reaches the controls.
  Keep the line while the sheet is down, and let one tap open the controls.
- **A landscape phone** leaves the story about 15px. Needs a minimum sheet
  height, or the footer hidden on short screens.
- **Stop cameras are resolved** only at load and when crossing 768px, not
  when the map resizes within a layout.
- **The width-change listener runs before the story loads.** A width change
  during loading throws a ReferenceError.
- **A stop with no title and no text** leaves the folded strip blank.
- **Dead CSS:** `#panel-controls #search-results { max-height: none }` beats
  the phone's `max-height: 40vh` in `overlays/search.css`.
- **The lowered sheet's summary line restates the field style by hand.**
  Scope the story-folded bar look to `body.story-folded:not(.sheet-down)`.

Fine as they are: `storyOpen`/`story-folded` and `sheetDown`/`sheet-down`
(each written in one function), `no-overlay-quiet` and `story-at-end` (one
writer each), and the story strip and "Return to story" (both call
`openStory`). The two-writer fault is `inert`, set by both `setStoryOpen`
and `setSheetDown`; compute it in one place.

## Verifying in a browser

The Chrome extension's tab is hidden, so `requestAnimationFrame` never fires,
scroll events don't dispatch, CSS transitions freeze, and timers are
throttled.
- **The frame timer:** load the app in a same-origin iframe and replace
  `requestAnimationFrame` on its window as soon as its URL appears (poll
  every 2ms), before the app's first frame.
- **Scrolling:** set `scrollTop` or `scrollLeft`, then dispatch a `scroll`
  event yourself.
- **Transitions:** inject `*{transition:none!important}` to measure end
  states.
- **Phone layout:** a 390×844 iframe; window resize doesn't change the
  viewport.
- **Only a real screen can show:** animation feel, swipe physics and timing.

## Loose ends

- **#218** (`preview_urls` for per-PR Cloudflare previews) is open; it takes
  effect only once merged.
- **#220:** story cameras that fit a region (`everything`, a book).
- **The PR's screenshots and description are stale.** Refresh them after the
  clean-up.
- **A temporary public preview may still be running** on the old session's
  machine: `vite preview` on 4173 and a `cloudflared` quick tunnel. Stop both
  (`pkill -f "vite preview"`, `pkill -f "cloudflared tunnel"`) if nobody is
  using them.
