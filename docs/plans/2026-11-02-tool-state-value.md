# The tools state as a value

**Issues:** #558 (createApp), #565 (link previews)
**Date:** 2026-11-02
**Status:** Proposed, revised after review. Not built.

The code references below are to main at `244824e0`.

## The problem

The tools are the search and at most one overlay. Since #567 their state lives in one module,
`packages/shell/src/toolsState.ts`, but it is a mutable object, so the shell has to say after
every change what the change meant:

- **The follow-ups vary.** Each path that changes the tools decides for itself what follows:
  repaint, panels, legend, popup, front tool, files, telemetry and URL.
- **Reading a link takes two calls,** `switchTo` then `restore`, while writing one is a single
  `toUrl`.
- **The story blend works out the tools a second time.** `pictureForStop`
  (`scrollytelling/overlayBlender.ts`) rebuilds each stop's settings from its link parameters and
  applies the colour rule itself.

The refactor changes nothing a reader can see. Where today's behaviour looks accidental, this plan
keeps it and names it. The one exception is a text opening an overlay, which becomes one step
where today it is two, with no visible difference.

## The value

```ts
interface ToolState<S> {
  readonly active: string | null;                 // the overlay that is on
  readonly overlays: ReadonlyMap<string, unknown>; // every overlay the reader has touched
  readonly search: S;                              // the one search
}
```

- **Every overlay the reader has touched is kept,** so switching away and back finds what was
  left. An overlay with no entry has its defaults.
- **The search sits apart,** because there is always exactly one, so its settings keep their type.
- **The empty state is per text:** `emptyTools(search)` gives the search its defaults.

Everything else is a function of the value, given the text's search and overlays:

- **Questions:** the active overlay and its settings, `shown(state, loaded)`, `picked(state)`,
  `searching(state)`. These replace the module's getters.
- **Changes, each returning a new value:** `withActive(state, id)`,
  `withOverlaySettings(state, overlay, update)`, `withSearch(state, update)`,
  `withReset(state, overlay)`. An id the text doesn't have, or `none`, makes `active` null, as
  `switchTo` does today.

The colour rule runs only when settings are written, as it does today. An overlay's new settings
avoid the search's colours, and the search's avoid the overlay's. Switching to an overlay keeps
the settings it holds as they are, even if the search's colours changed since.

A settings update already takes the current settings and returns the next ones, so overlays don't
change. The value relies on updates returning a new object, and the blend's cache relies on values
never changing. So the value is frozen whenever it is built, nested settings included (the IEEE
VIS citations overlay holds lists). An update that edits settings in place then throws, in tests
and in the browser.

## Links, against a base

- **`toLink(state)`** writes the active overlay, its settings and the search's settings, leaving
  out values at their default.
- **`fromLink(link, base)`** applies a link on top of `base`. The search's settings come first,
  then the named overlay's, chosen to avoid the search's colours. A link that names no overlay
  makes `active` null. Every other overlay keeps what `base` held.

`fromLink(link, emptyTools(search))` is what a link preview would draw (#565).

**Leaving a story trims the overlay only:** `withOverlayTrimmed(state)` keeps of the active overlay
what a link carries, as `keepOnlyLinked` does today. The search stays exactly as it is, because a
link doesn't record which word has which colour, so passing the search through a link could swap
its colours. With no overlay on, the value comes back unchanged.

## Stories

A story stop names an overlay, its parameters and the search's parameters, which together are a
link. So stops become values once, in the shell, after each text's `stories.resolve`:

- **For drawing,** `fromLink(stop, emptyTools(search))`. Stops that name the same tools share
  one value. The resolver keeps a map from a stop's link text to its value, which is today's
  `cacheKeyFor` moved there. Stops that only move the camera are common, and each would otherwise
  compute the same picture again.
- **The blend's picture cache** keeps its nesting by squares and loaded files. Its inner map is
  keyed by the value instead of a string. The blend's own call to the colour rule goes.
- **For arriving at a stop,** `fromLink(stop, state)`, so the reader's other overlays keep their
  settings, as now.
- **Hot reload on the dev server** re-resolves the stories, which makes new values. The old ones
  are dropped from the cache with them.

A story is then a sequence of camera, pin and tool state.

## One place for what follows

The shell holds one variable, `let tools`, and changes it through one function:

```ts
setTools(next: ToolState<S>, by: 'reader' | 'outside'): void
```

**`outside`** is a story stop, or a link, including Back. Both already run inside
`applyingExternalState`, which turns off URL writes, so the URL needs no case of its own.
**`reader`** is every reader action and a text's hooks. They go through `setOverlay`,
`changeSettings` and `changeSearch` today, including the legend card's × and the starting points
under None.

What follows today, which `setTools` reproduces:

- **A reader edits the overlay's settings** (`changeSettings`): repaint (`applyTools`, `render`);
  the overlay panel redrawn keeping the control's focus; legend and popup; URL replaced.
- **A reader edits the search** (`changeSearch`): the search's `readerChanged` telemetry;
  repaint; the search panel redrawn keeping focus; legend and popup; the search's files fetched;
  URL pushed if the search turned on or off, replaced otherwise.
- **A reader picks an overlay** (`setOverlay`): switch telemetry; the old overlay's `destroy()`
  and the `body` attribute; the overlay panel fresh; legend and popup; repaint; URL pushed.
- **A text opens an overlay** (the `openOverlay` hook): `takeOver`; if the overlay isn't on, its
  settings reset, then the switch above; then the edit above; then its panel opened. Today that is
  two paints and two URL writes, the second replacing the first. **It becomes one `setTools`**
  with the switch and the settings together: one paint and one push. Nothing visible changes, and
  Back still returns to before the click.
- **A text changes the search** (the `changeSearch` hook): `takeOver`, the search edit above, then
  the search panel opened.
- **A story stop arrives** (`syncStoryStopStateUnguarded`): the old overlay's `destroy()` and the
  `body` attribute only if the overlay differs; the pin set; both panels fresh, which calls the
  search's `destroy()` and sends its `replaced` telemetry; legend and popup (twice today, once
  after); the search's files fetched; the search put in front if it is on. No repaint, because the
  story draws the map.
- **A link or Back** (`applyViewState`): the old overlay's `destroy()` and the `body` attribute
  every time, even for the same overlay; the pin set; both panels fresh, with the search's
  `destroy()` and `replaced`; legend and popup (twice today, once after); the search's files
  fetched; repaint; the open panel put in front only when leaving story mode.

So `setTools` compares the old and new values for a `reader` change and runs only what that
change touches: the overlay switched, the overlay's settings changed, the search changed. Its URL
write is pushed when the overlay switched or the search turned on or off, and replaced otherwise,
which is every reader row above, the hook included. For an `outside` change it runs every
follow-up for both tools without comparing, as today. Rebuilding the panels only on a real change is #569, kept out of this refactor.

Two smaller differences are accepted:

- The legend and popup run once instead of twice on a stop or a link.
- A reader's edit that returns the same settings object no longer repaints. The picture would be
  the same.

**Leaving a story is not a `setTools` call.** `leaveStory` keeps its own steps: `takeOver`, trim
the overlay, repaint if an overlay is on, `render`, URL pushed. It redraws no panel or legend, so
they keep showing what the stop set. That may be a bug; it isn't checked or changed here.

**Outside `setTools`:** the pin, `takeOver`, the camera and the panel frame. A stop and a link set
the pin before calling `setTools`, so the panel draws the pin; a test fails if that order changes.

## Steps

Each step is one pull request that typechecks and passes on its own.

1. **The value and its link functions.**
   - What it covers: the value with string ids; `fromLink`, `toLink` and `withOverlayTrimmed`; the
     story stops resolved to values; the blend using them.
   - Where the value lives: inside the existing module, as one `let state`, whose methods call
     the new functions. Its `switchTo` and `restore` pair becomes one `fromLink`, and the mutable
     settings store goes.
   - Checks: unit tests for the functions, and the blend's existing tests; the layout suite on all
     four texts.
2. **`setTools`.**
   - What it covers: the follow-ups above, with the `openOverlay` hook as one change. The
     module's variable moves into the shell as `let tools`, and the module itself goes.
   - Checks: unit tests for the comparison; the layout suite on all four texts, plus the loading
     suite, because search file fetching moves into `setTools`. Telemetry has few tests, so the
     order of events on the hook path is checked once by hand.
3. **Optional: ids and settings typed by each text.** The shell becomes generic over a text's
   settings map, with each overlay's settings type read from what its `settingsFromUrl` returns.
   A scratch type-check against the real Tanakh overlays confirmed that this works and that a
   Haftarah setting given to Trop is refused. The obvious pattern, matching `Overlay<…, S, …>`,
   does not infer.
   - Costs: about 15 source files and 10 tests change. The Tanakh's registry, which tests fill
     with just the overlays they need, gives way to its record of implementations. Ids from
     outside are checked with `Object.hasOwn`, not `in`, which accepts `constructor`.
   - What it doesn't do: remove the loose method check. Code that handles any overlay still holds
     an untyped list (#559).
   - Ids are each text's literal union, never an `enum`. The repo's scripts run under Node with
     their types stripped, and that can't handle an `enum`.

## Not in this work

- Rebuilding the panels only when the tools change (#569).
- Hover and pin as one object, option 3 in #558.

## Alternative

A value shaped exactly like a link, with the touched overlays kept in a second variable beside it.
Every switch would then save into that variable and load from it, which is the wiring this plan
removes.
