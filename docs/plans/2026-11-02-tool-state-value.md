# The tools state as a value

**Issues:** #558 (createApp), #565 (link previews)
**Date:** 2026-11-02
**Status:** Proposed, not built.

## The problem

The tools are the search and at most one overlay. Since #567 their state lives in one module,
`packages/shell/src/toolsState.ts`, but it is a mutable object, so the shell has to say after
every change what the change meant:

- **The follow-ups vary.** Six paths change the tools: a reader's edit, picking an overlay, a
  text's `openOverlay` hook, a story stop, a link or Back, and leaving a story. Each decides for
  itself what follows (repaint, panel, legend, popup, URL, telemetry), and the orders differ.
- **Reading a link takes two calls.** It is `switchTo`, then `restore`, while writing one is a
  single `toUrl`.
- **The story blend works out the tools a second time.** `pictureForStop`
  (`scrollytelling/overlayBlender.ts`) rebuilds each stop's settings from its link parameters,
  applies the colour rule itself, and caches the pictures by a string made from those parameters.

## The value

A text's settings map `M` gives each of its overlay ids that overlay's settings type, for example
`{ trop: TropSettings; haftarah: HaftarahSettings; … }`. It is worked out from the text's record
of overlays, never written by hand:

```ts
type Overlays<I, M> = { readonly [K in keyof M]: Overlay<I, M[K]> };

interface ToolState<M, S> {
  readonly active: keyof M | null;                    // the overlay that is on
  readonly overlays: { readonly [K in keyof M]?: M[K] }; // every overlay the reader has touched
  readonly search: S;                                  // the one search
}
```

- **Every overlay the reader has touched is kept,** not only the one showing, so switching away
  and back still finds what was left. An overlay with no entry has its defaults.
- **The search sits apart,** because there is always exactly one.
- **Ids and settings are typed throughout.** The shell is generic over `M`, as it already is over
  a text's square type and search settings. A text hands it its overlays as a typed record, in
  place of today's list, with a separate list of ids for the menu's order.
- **The shell reads and writes settings with no casts.** Its functions are generic over the id
  (`settingsOf<K extends keyof M>(state, overlays, k: K): M[K]`). A Haftarah setting can't reach
  Trop. This removes the loose method check on settings that the overlay list needs today, so
  #559 isn't needed.
- **Strings from outside, a link's or a story file's, are checked once** (`id in overlays`) when
  they're read.
- **Ids are the text's own literal union** (`keyof M`), not an `enum`. The shell can't name any
  text's ids. The repo's scripts run under Node with their types stripped, and that can't handle
  an `enum`.

Everything else is a function of the value, given the text's search and its record of overlays:

- **Questions:** the overlay, its settings, the search's settings, `shown(state, loaded)`,
  `picked(state)`, `searching(state)`. These replace the module's getters.
- **Changes, each returning a new value:**
  - `withOverlay(state, id)`
  - `withOverlaySettings(state, overlay, update)`
  - `withSearch(state, update)`
  - `withReset(state, overlay)`

  Each applies the colour rule: an overlay's new settings avoid the search's colours, and the
  search's avoid the overlay's.

A settings update already takes the current settings and returns the next ones, so overlays don't
change. The value relies on updates returning a new object, never editing the old one; a test
over every overlay's controls holds that.

## Links, against a base

- **`toLink(state)`** writes the overlay, its settings and the search's settings, leaving out
  values at their default. It drops the settings held for overlays that aren't showing.
- **`fromLink(link, base)`** applies a link on top of `base`. The search's settings come first,
  then the named overlay's, chosen to avoid the search's colours. Every other overlay keeps what
  `base` held.

Leaving a story becomes `fromLink(toLink(state), state)`, so `keepOnlyLinked` goes. A link with
no base, `fromLink(link, EMPTY)`, is what a link preview would draw (#565).

## Stories

A story stop names an overlay, its parameters and the search's parameters, which together are a
link. The stops can therefore be read once, when the story is resolved:

- **For drawing,** `fromLink(stop, EMPTY)`. The blend then draws between two values. The cache is
  keyed by the value itself (a `WeakMap`), so the parameter strings, `paramsKey` and
  `cacheKeyFor` go, along with the blend's own call to the colour rule.
- **For arriving at a stop,** `fromLink(stop, state)`. The reader's other overlays keep their
  settings, as they do now.

A story is then a sequence of camera, pin and tool state.

## One place for what follows

The shell holds one variable, `let tools: ToolState`, and changes it through one function:

```ts
setTools(next: ToolState, why: 'reader' | 'hook' | 'stop' | 'link' | 'leave-story'): void
```

It compares `tools` with `next`: the overlay changed, the overlay's settings changed, the search's
settings changed, or nothing. Then it runs what follows. What follows depends on why, and that is
the real reason the six paths differ today:

| Why | Overlay switched | Telemetry | Panel redraw | URL |
|---|---|---|---|---|
| `reader` (an edit or the picker) | `destroy()`, `body` attribute | switch, search change | keeps the control's focus for an edit; fresh for a switch | written; pushed when search turns on or off |
| `hook` (a text opens an overlay) | as `reader` | as `reader` | as `reader` | as `reader` |
| `stop` | `destroy()`, `body` attribute | the search's `replaced`, from the fresh panel | fresh | not written |
| `link` (a link, or Back) | `destroy()`, `body` attribute | as `stop` | fresh | not written |
| `leave-story` | none | none | none | written |

Writing this table down is half the work. Each row has to be checked against today's code before
it's built, and any difference found is a bug or a decision for Danyel, not a quiet change.

The pin stays outside the value, which is option 3 in #558. A story stop and a link set the pin
before the panel is drawn. They keep doing so by setting it before calling `setTools`.

## What goes

- `createOverlaySettings`'s mutable store becomes the map inside the value.
- `toolsState.ts`'s `restore`, `reset`, `keepOnlyLinked` and `switchTo` go, and its getters
  become functions of the value.
- The blend's parameter strings and its own use of the colour rule go.

## Alternatives

- **One map for every tool, the search included.** This is simpler to write, but the search's
  settings come out of the map untyped and need a cast at every read.
- **A value shaped exactly like a link,** with the touched overlays kept in a second variable
  beside it. Every switch would then have to save into that variable and load from it, which is
  the wiring this plan removes.

- **Keep the mutable module and add `fromLink` and a "what changed" result.** This is smaller,
  but the blend keeps its second copy of the rule, and previews (#565) still need a page-bound
  object.
- **A manager object around the value.** It would wrap one variable and one function. Add it only
  if something besides the shell needs to hold the tools.

## Testing

- Unit tests for the value's functions: the colour rule both ways, `fromLink` on a base keeping
  other overlays' settings, and `toLink` after `fromLink` giving the same link.
- A test that every overlay's settings updates return a new object.
- `setTools`'s comparison gets unit tests. Its follow-ups are checked by the layout suite on all
  four texts and the loading suite. The blend's existing tests carry over.

## Open questions

- Should a story stop's arrival keep the reader's settings for overlays the stop doesn't show?
  It does today, and this plan keeps that.
- `why` has five values for two kinds of follow-up. If the `hook` row stays identical to
  `reader`, it can fold into it.
