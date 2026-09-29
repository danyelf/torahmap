# More than one story

**Date:** 2026-09-27
**Status:** Built in #265.
**Issues:** #235, the first half of #232, #264. Step 4 of
[Where everything lives](2026-09-23-ui-information-hierarchy-design.md).

## The story files

Each story is a Markdown file in `src/stories/`, and its file name is the id
the URL uses. The tour moves there from `public/data/story.md`, unchanged apart
from its frontmatter — the same shape as the drafts in #254:

```
---
title: The Guided Tour
description: Introduces the Torahmap by following how Abraham is remembered across the Tanakh.
order: 1
---
```

Every story is built into the page. A story is about 5 KB, under 2 KB
compressed, so a dozen of them add about 20 KB to a page whose verse text alone
is 8.8 MB, and in return there is no second fetch before the story appears and
nothing to fail when switching stories.

**Order.** A story with an `order` comes before any story without one; a lower
`order` comes before a higher one; ties, and stories without an order, go by
file name. The first story listed is what a bare `torahmap.org` opens.

**Drafts.** `draft: true` lists a story on the dev server and on every branch's
preview, but not on the live site, which is the build of `main`. The build
decides (`__SHOW_DRAFTS__` in `vite.config.ts`); nothing looks at the address.
Drafts exist so Danyel can see a story while
writing it; nothing is done to make a draft's link meaningful or shareable on
the live site, and drafts are in the live site's code even though it does not
list them.

A short draft story with two stops, `sample.md`, lives beside the tour so the
list can be tested with more than one entry.

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

One card per listed story, in menu order: title, then description.

- A story read this visit also shows "Stop 7 of 21: *label*", with
  **Continue** and **Start from the beginning** — today's card.
- A story not yet opened has one button, **Read**, which starts at its first
  stop.
- A draft card carries a small "draft" tag.

Opening a story from a card enters reading mode the way Continue does today,
with the same camera move, and replaces the column's text with that story's.

The menu's first item continues the story last read, and names it:
"Continue *The Guided Tour* 7/21". Before any story has been read it offers
the first listed one at its first stop.

Accepted as they are: the current story's card offers Continue at stop 1 when
the page opened on an explore link, though the reader never read it; and the
page-view event records the story the link named, not the one that opened.

Reading mode is otherwise unchanged.

## Code

- `src/stories/index.ts` gathers every `.md` beside it at build time.
- `packages/stories/src/storyIndex.ts` decides what is listed, and in what order —
  a pure function of the stories and whether drafts are shown.
- `storyParser.ts` reads the frontmatter keys listed in `STORY_HEADER_KEYS`. A
  test refuses any other key in a story file, a `draft` that is not `true` or
  `false`, and an `easing` that names no easing.
- `main.ts` keeps one current story, and a map of where each other story was
  left. `switchStory` changes the current story and records the place of the
  one it replaces; a card and a `#story=…&stop=…` link both call it, then open
  the story — a card easing the camera there, a link cutting to it. An edited
  story reloads in place on the dev server.

## Telemetry

The story events — `page_view`, `story_stop`, `story_exit`, `story_return` —
record a stop id, and stop ids can repeat across stories. Each gains a `story`
blob, appended after the existing blobs in `src/telemetry/schema.ts` so no
column moves. `story-reach.sql`, `story-exits.sql` and `story-returns.sql`
group by story as well. Rows from before this have an empty story; they were
all the tour, but the queries show them as a row of their own.

## Tests

In vitest: the order and draft rules; every story has a title and description,
and an `order` that reads as a number; the URL's `story` and `stop` both ways;
the fallbacks for an unknown story or stop.

In the layout tests: the Stories panel with the tour and the sample, the second
card scrolled into view on a phone, the menu with its longer first item, and
the sample story itself.

## Alongside

PR #260 (cross-fade) also changes `main.ts` and the story code; whichever lands
second rebases. The drafts in #254 move from `public/data/stories/` to
`src/stories/` and gain `draft: true` when they are merged in.
