# Credits tab — design

Issue: [#100](https://github.com/danyelf/torahmap/issues/100)

## The problem

The help modal's credits are two lines at the bottom of the Overview tab. They
name Sefaria, the Hebrew edition and the English edition, and nothing else. The
map also depends on the ETCBC BHSA database, Wikipedia's "Dating the Bible"
article and Mechon Mamre's readings page, none of which is acknowledged
anywhere in the interface. Several of those carry attribution or share-alike
terms, so this is an obligation and not only a courtesy.

The same lines are hard to read. There is no `a` rule anywhere in `src/styles/`
or `index.html`, so every link in the modal renders in the browser's default
`#0000EE` on a `#1e1e1e` panel. Inline with ordinary words, the links read as
dimmer than the prose around them rather than brighter.

## What we are building

A fourth tab in the help modal, `Credits`, whose contents come from the overlay
registry rather than from a hand-written list. Each overlay declares the sources
it depends on; the tab renders a block per overlay that declares any, headed by
that overlay's own name. Sources that belong to the map as a whole rather than
to any one overlay are declared separately and render first.

The point of routing this through the registry is that the credits cannot drift
away from the features. Add an overlay with a new data source and there is a
place for its credit and a test that fails until it is filled in.

## Declaring a credit

A new leaf module, `src/credits.ts`, which imports nothing:

```ts
export interface Credit {
  source: string;      // "ETCBC BHSA (2021), read through Text-Fabric"
  url?: string;
  license?: string;    // "CC BY-NC 4.0"
  collected?: string;  // "September 2026"; omitted when not recorded
  note?: string;       // only where a licence or a caveat demands it
}
```

`src/overlays/types.ts` gains one optional field on `Overlay`:

```ts
credits?: readonly Credit[];
```

This follows the precedent `urlParams` already set in that interface: the
overlay declares what it depends on, and a central module decides how to show
it. No overlay writes markup.

`note` is reserved for licence obligations and genuine caveats. It is not for
describing what a source does — the block heading already says which feature
the source feeds. In practice the whole tab carries two notes: the DOI that
BHSA's licence asks us to cite, and the fact that commentary counts trail
Sefaria's live site.

## Keeping the dependency graph one-way

`src/credits.ts` owns the rendering as well as the type, but it must not import
`Overlay`, because `src/overlays/types.ts` imports `Credit` and that would close
a loop. The renderer therefore takes a structural type:

```ts
export function renderCreditsHtml(
  overlays: readonly { name: string; credits?: readonly Credit[] }[],
): string
```

`src/help.ts` calls `renderCreditsHtml(getAllOverlays())`. Dependencies run one
way: `credits.ts` is a leaf, `overlays/types.ts` imports from it, and `help.ts`
imports from both. The renderer can also be tested against a fabricated list
with no registry involved.

`TAB_CONTENT` in `help.ts` is a module-level constant today. The credits tab's
content becomes a function evaluated when the tab is opened, because a static
string would snapshot an empty registry at import time and render nothing.
Registration happens at `main.ts:118` and `initHelp` at `main.ts:833`, so the
ordering at runtime is already safe; the function is what makes it safe
regardless.

## What the tab says

### The map itself

From `APP_CREDITS` in `src/credits.ts`, rendered above the overlay blocks.

| Source | Licence | Collected | Note |
| --- | --- | --- | --- |
| Miqra according to the Masorah, Hebrew Wikisource | CC BY-SA | September 2026 | The Hebrew text, downloaded via Sefaria. The Trop overlay reads its cantillation marks out of this edition, and Hebrew search matches it with vowels and cantillation ignored. |
| THE JPS TANAKH: Gender-Sensitive Edition, Jewish Publication Society | CC BY-NC | September 2026 | The English text, downloaded via Sefaria. The English search index is built from it. |

### One block per overlay

| Overlay | Source | Licence | Collected | Note |
| --- | --- | --- | --- | --- |
| Text Search | ETCBC BHSA (2021), read through Text-Fabric | CC BY-NC 4.0 | September 2026 | Cite 10.17026/dans-z6y-skyh |
| Commentary | Sefaria link exports | Sefaria's terms | January 2026 | Sefaria regenerates these monthly, so counts trail the live site. |
| Haftarah | Mechon Mamre, Weekly Torah Readings | none stated | January 2026 | © Mechon Mamre 2013. The page states no licence. |
| Text Dating | Wikipedia, "Dating the Bible" | CC BY-SA | January 2026 | — |

Trop and Verse Length declare no credits and do not appear. Both derive
everything from text that is already credited: Trop reads the cantillation
marks out of the Hebrew edition, and Verse Length counts characters.

## Where the collection dates come from

No data file carries a generation timestamp, so the dates are hand-maintained
strings in `src/credits.ts`.

Git cannot supply them. The last commit to touch `lexicon.json` only moved the
file into a folder, and the last to touch `tanakh-structure.json` was a
refactor; harvesting commit dates would claim both were collected in a month
when nothing was fetched. A wrong freshness claim is worse than none.

A date is therefore given only where a commit plainly is a collection event:

- **September 2026** for the two text editions. Commit `87681ae` rewrote all 78
  files under `data/texts/`, which is a re-download.
- **January 2026** for Mechon Mamre. Commit `b4c3794` added
  `data/readings.html`, the cached copy of their page.
- **January 2026** for the commentary counts. Commit `109da61` regenerated
  `commentary-counts.json` from Sefaria's link CSVs. The CSVs
  themselves are not in the repository, but Sefaria re-exports them monthly, so
  the counts are at most about a month older than the file.

Two further dates come from Danyel directly rather than from the repository:
BHSA was pulled in September 2026, and the Wikipedia article was read in
January 2026. Neither is recoverable from git, which is the whole reason the
field is hand-maintained.

No entry then reads "collection date not recorded". `tanakh-structure.json`
would have been the one, but Sefaria has no row of its own: a row covering both
the export bucket and the verse counts could only carry one date between two
things collected at different times, and it confused every reader who met it.
Sefaria is still credited in two places: each edition's note says it was
downloaded via Sefaria, and the Commentary block credits Sefaria's link exports,
where it is the actual source rather than the delivery mechanism.

`DATA_REGENERATION.md` gains a line beside each regeneration command reminding
whoever runs it to update the date in `src/credits.ts`. Nothing enforces that,
which is the known weakness of this approach. Having the generators stamp a
shared manifest that the tab reads would remove the drift, and the `collected`
field is shaped so that change would swap where the string comes from without
touching the type or the rendering. That is filed as a follow-up rather than
built now.

## Layout and colour

Each row is a two-column grid: the source name on the left, the licence in a
small muted pill on the right, and the collection date and note wrapping
underneath across both columns. Block headings are small muted uppercase
labels.

Within this tab, blue means clickable and nothing else. Elsewhere in the modal
`#6ab0f3` marks things that are not links — the `dt`s in the Overlays tab, the
first column of the Controls table. In a tab where nearly every row carries a
link, reusing blue for headings as well would blur exactly the distinction the
issue is about.

Links get the rule the project has never had, scoped to `.help-body` so it
cannot leak into the map interface: `#8ec5f7`, underlined at a 2px offset,
hover `#b6d9fa`, and a visible focus ring. Measured against the `#1e1e1e`
modal, `#8ec5f7` gives 9.1:1 where the body prose `#bbb` gives 8.7:1, so links
read brighter than the words around them. The tab accent `#6ab0f3` reaches only
7.9:1, which is dimmer than the prose and would have left the complaint
standing.

The palette registry the issue suggests drawing this from was PR #62, which is
closed and unmerged, so these values sit beside the existing constants in
`help.css`.

## The Overview tab

The two credits paragraphs shrink to one byline:

> By Danyel Fisher · GitHub · Sources and credits

"Sources and credits" switches to the Credits tab. Because `switchTab` replaces
the body's `innerHTML`, that needs a delegated click handler on `.help-body`
reading a `data-goto-tab` attribute, not a listener bound to the element.

## Testing

`src/__tests__/unit/credits.test.ts`, new:

- The renderer, against a fabricated overlay list: a block is omitted when
  `credits` is absent, the licence pill is omitted when `license` is absent, the
  collection line reads "not recorded" when `collected` is absent, anchors carry
  `target="_blank"` and `rel="noopener noreferrer"`, and values are HTML-escaped.
- A drift guard over the real registry: after `registerAllOverlays()`, every
  registered overlay either declares `credits` or appears in an explicit list of
  overlays that derive everything from already-credited text (`trop`,
  `verse-length`). A seventh overlay with a new data source fails the suite until
  it is credited.
- Every credit that carries a `url` uses `https`.

`src/__tests__/unit/help.test.ts`, new — the help modal has no tests today:

- The Credits tab renders and contains each expected source name.
- The Overview byline's link switches the modal to the Credits tab.
- The chosen tab persists through `localStorage`, as the other three do.

## Verification

`npm test` and `npm run typecheck`, then a dev server started for this worktree
and a screenshot of the tab. Per `AGENTS.md` a UI change is not complete until
Danyel has looked at it.

## Out of scope

- `talmud.html`, which never calls `initHelp`.
- Any change to the data files themselves.
- Making the generators stamp their own collection dates; filed separately.

## Open questions

None outstanding. The commentary collection date rests on Sefaria's monthly
re-export cadence rather than on a recorded download, which is stated in the tab
itself through the note about counts trailing the live site.
