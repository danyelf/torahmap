# Overlays Are Functions — Design

**Issues:** #179 (shape), #177 and #178 (the P1 bugs that follow from it),
#74, #76, #122, #56, #169 (the same cause, filed separately)
**Date:** 2026-09-17
**Status:** Approved, not yet implemented.

## The problem

An overlay declares eighteen members over a page of module-level `let`s. One of
them is the colour rule:

```ts
getVerseColor(verse: TanakhIdentity): Color | Color[] | null
```

It takes no settings argument, because the settings are ambient — `currentCategory`,
`currentCustom`, `selectedTrop`, search's `terms`. The other seventeen members
load data, draw controls, draw the legend, answer hover, and serialize to the
URL, all reading and writing those same variables.

So there is no function from settings to colours. There is "write the settings
into the module, then read the colours back out". Both open P1 bugs are that
sentence with different consequences.

**#178.** To sample a story stop, `overlayBlender.ts` writes the stop's
parameters into the overlay and reads its colours. Sampling the destination
makes the destination current, and it stays current after the sample. `main.ts`
may still consider the source stop dominant, so a hover repaints from the wrong
stop. Through the five Abraham stops this also re-runs a full-corpus search, and
rebuilds the results DOM, and sends a GA4 `search_execute` event, twice per
animation frame per term.

**#177.** `restoreFromUrlUnguarded` is five `if (present) apply` statements with
no `else`. A field the URL does not mention keeps whatever was there, so
returning to an empty hash leaves the previous overlay, pin and mode live. It
also decides Explore from `overlay || verse` while the writer emits camera keys
whenever nothing is pinned, so reader and writer disagree about what an Explore
URL looks like.

## What an overlay is

```
f(items, settings) -> colours
```

Everything else is one of three things around that: the data `f` reads, the
settings `f` takes, or presentation that displays the settings and asks for new
ones.

Splitting it that way makes both bugs unrepresentable rather than fixed. The
blender cannot leave residue in a function. A settings value that is always
complete has no notion of "a field the URL did not mention".

## The four parts

**The rule.** Pure, `colorsFor(items, settings)`. Given the same settings it
returns the same colours, whatever the overlay is currently showing.

**The settings.** A value the app owns and hands to the rule. Always complete:
every key the overlay declares is present, defaults included.

**The presentation.** Controls, legend, sidebar, hover text, text highlighting.
Reads the settings it is given; asks for a change rather than making one.

**The data.** Commentary counts, the haftarah tables, the trop index, the lexeme
index. Loaded once, shared, never per-evaluation.

## What changes

### The rule comes out

Each overlay grows `colorsFor(items, settings)`. `getVerseColor` is defined in
terms of it with the overlay's current settings, so the rule is written once and
has two callers rather than two implementations.

Search needs `runSearch` split first. Today it computes the matches, stores
them, redraws the results list and term rows, fires `updateCallback`, and sends
one analytics event per active term. Only the first part belongs to the rule.
The rest is what happens when a reader searches, and moving it out is what stops
the scroll from fabricating GA events.

### Settings become a value

`UrlParamSpec` gains a `default`. `validateOverlayParams` fills in any key the
input omits, so what reaches an overlay is complete and `applyUrlParams` assigns
unconditionally — `currentCategory = settings.category`, not `if (category)`.
That is #74, enforced in the validator instead of remembered six times.

### Presentation is drawn after the settings land

`activateOverlay` splits into swapping the instance and drawing its UI, and the
restore path does them in that order with the settings applied between.
Commentary's `renderControls` already ends in `select.value = currentCategory`;
it shows the wrong thing only because it runs before the value arrives. Haftarah's
hand-written `#custom-select` update inside `applyUrlParams` comes back out.
That is #76 and #122.

### The blender evaluates, and never writes

`computeBlendedColors` calls `colorsFor` for each endpoint and blends the two
arrays. It no longer calls `applyOverlayParams`, so it cannot leave residue.
Results are memoised on the settings, not on the stop — the key is the
settings in their serialized form, which already exists and is already
canonical. Two stops asking for the same thing share an entry, a stop that is
rewritten invalidates nothing, and no part of the blender knows how many stops
there are or what they are called. Entries are built as they are asked for.

`computeItemStates` takes a resolved colour array instead of an overlay. A
settled frame passes the current overlay's colours and a transition frame passes
the blended array, and both then composite hover through `applyItemColors`. The
highlight therefore survives a transition, and hit detection re-runs each
transition frame so it tracks the cursor while the camera moves. That is the
rest of #56. `main-talmud.ts` is the other caller and takes the same change.

### The URL becomes one transition

Parsing resolves a complete view state — mode, overlay, settings, verse, camera
— with every absent field at its default. Applying it is one ordered pass: mode,
overlay instance, settings, presentation, verse, camera, paint. Nothing is
conditional, so an empty hash resets rather than leaves.

Camera comes before centring. `centerOnVerse` computes the pan from
`camera.zoom`, and today it runs before the URL's zoom is applied, so a link
carrying both a verse and a zoom centres at zoom 1 and then jumps to zoom 8
without recentring — which puts the map outside the viewport. That is the
likeliest cause of #169's black canvas, and the repro decides it.

## What this closes

#179, #177, #178, #74, #76, #122, and the surviving half of #56. #169 if the
ordering diagnosis holds. #73 — validating parameters on the way out — gets
easier and stays open.

## Testing

The valuable tests are on the parts that are now pure:

- `colorsFor` returns the same colours for given settings regardless of what the
  overlay is currently showing.
- The overlay's own settings are unchanged after a blend.
- A view state resolves a default for every key the URL omits.
- Blended colours composited with a hovered verse brighten that verse.

Then one test per reported bug: a camera-only hash entering Explore; a back
navigation to an empty hash clearing overlay and pin; a link carrying a category
leaving the dropdown reading that category; a link carrying a verse and a zoom
landing on the verse.

And one that states the thing being asked for: story and Explore paint through
the same composite.

## Assumptions and open questions

Kept during implementation, cleared before the PR leaves draft.

- #169's black canvas is the centre-then-zoom ordering. Diagnosed from the code,
  not yet reproduced. The issue's warm-load evidence does not fit, because
  assigning `location.hash` fires `hashchange` and this app listens only to
  `popstate` — so the warm case may not have exercised the restore path at all.
- #56's repro says colours vanish at rest. Reading the code says settled frames
  paint through the Explore path, so that half should already be fixed. To be
  confirmed rather than assumed.
- Settled: search settings are a plain ordered list of terms, each carrying its
  own colour slot. A list rebuilt from a URL takes slots by position; a list the
  reader has edited keeps the slots it has. Nothing needs identity across
  evaluations, because searching for two words is simply a different state from
  searching for one of them — the word they share keeps its colour, and the word
  that is only in one of them lerps in or out against the background.
