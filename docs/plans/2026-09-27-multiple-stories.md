# More than one story

**Date:** 2026-09-27
**Status:** Designed, not built.
**Issues:** #235, the first half of #232. Step 4 of
[Where everything lives](2026-09-23-ui-information-hierarchy-design.md).

## Files and the index

The tour moves from `public/data/story.md` to `public/data/stories/tour.md`,
unchanged apart from a `title:` and `description:` in its frontmatter — the
same shape as the drafts in #254.

`public/data/stories/index.json` lists the stories in menu order:

```json
[{ "id": "tour" }, { "id": "test", "draft": true }]
```

The first non-draft entry is what a bare `torahmap.org` opens. Drafts are
listed everywhere except on torahmap.org, decided by hostname at startup.
Drafts exist so Danyel can see a story while writing it; nothing is done to
make a draft's link meaningful or shareable on the live site.

A short draft story with two or three stops lives beside the tour, so the list
can be tested with more than one entry. It is fetchable on torahmap.org by path,
but nothing links to it.

Only the story the URL names is fetched on load. The others are fetched when
the Stories panel opens, for their titles.

## The URL

While reading: `#story=tour&stop=abraham_call`. While exploring: the view, as
today, and the story's place is not in the URL. `stop` joins `story` in
`RESERVED_KEYS`. An unknown story falls back to the first listed one; an
unknown stop to its story's first stop. Old `#story=<stopId>` links therefore
open the tour at its start, which #235 accepts.

## Remembering places

Each story remembers its stop for the rest of the visit, in the page. Nothing
goes to browser storage. Reloading while reading lands on the story and stop in
the URL; reloading while exploring keeps the view and forgets the story's place,
as today.

## The Stories panel and the menu

One card per listed story, in index order: title, then description.

- A story read this visit also shows "Stop 7 of 21: *label*", with
  **Continue** and **Start from the beginning** — today's card.
- A story not yet opened has one button, **Read**, which starts at its first
  stop.
- A draft card carries a small "draft" tag.

Opening a story from a card enters reading mode the way Continue does today,
with the same camera move, and replaces the column's text with that story's.

The menu's first item continues the story last read, and names it:
"Continue *The guided tour* · 7/21". Before any story has been read it offers
the first listed one at its first stop.

Reading mode is otherwise unchanged.

## Code

- `src/scrollytelling/storyIndex.ts` (new) reads the index and decides what is
  listed — a pure function of the entries and the hostname.
- `storyParser.ts` reads `title` and `description` from the frontmatter it
  already parses for `easing`.
- `loadStoryData` takes a story id.
- In `main.ts`, `heldStop` becomes the current story's id and a stop per story.
- Choosing a story from a card goes through the same routine a
  `#story=…&stop=…` link does.

## Telemetry

The story events — `page_view`, `story_stop`, `story_exit`, `story_return` —
record a stop id, and stop ids can repeat across stories. Each gains a `story`
blob, appended after the existing blobs in `src/telemetry/schema.ts` so no
column moves. `story-reach.sql`, `story-exits.sql` and `story-returns.sql`
group by story as well; rows from before this have an empty story, which means
the tour.

## Tests

In vitest: the listing rule; every `.md` in `public/data/stories/` is in the
index and every entry has a file; the URL's `story` and `stop` both ways; the
fallbacks for an unknown story or stop; a place kept per story.

In the layout tests: the Stories panel with the tour and the test story, and
the menu with its longer first item at phone width.

## Alongside

PR #260 (cross-fade) also changes `main.ts` and the story code; whichever lands
second rebases. The tour's text and stops are moved, not edited, so the drafts
in #254 are unaffected.
