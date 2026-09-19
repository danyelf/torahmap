# Telemetry Design

**Date:** 2026-09-18
**Status:** Shipped — `src/telemetry/`, `src/worker/`, `scripts/telemetry/`.

## Problem

We want to know how the map is used: whether people read the story, how far
they get, where they go once they take the map, and what they do there.

## Decisions

- **No Google Analytics.** It records none of the story, sets cookies (so EU
  visitors may need a consent banner the site does not have), and counts
  visits from the dev server alongside real ones. Events go to Cloudflare
  Workers Analytics Engine through the site's own Worker. No cookies, nothing
  stored in the browser, no third party.
- **Analytics Engine keeps three months of data.** Accepted for now. D1 is
  built for read-heavy work, Pipelines needs the Workers Paid plan, and one R2
  object per event needs a compaction job; Honeycomb's free tier keeps 60 days.
- **The dev server sends nothing; everything else does.** Every event records
  its host, so a Cloudflare preview version (a `workers.dev` address) can be
  tested without mixing into real numbers — the report queries count only
  `torahmap.org`.
- **No dashboard yet.** A script runs saved SQL queries and prints tables.
  Cloudflare Web Analytics (the page-view beacon) was considered and left out:
  it has no custom events.

## How an event travels

The page posts JSON to `/api/event` with `navigator.sendBeacon`. Each page
load draws a random visit id held only in memory, so a visit's events can be
grouped without storing anything on the device.

The Worker serves static assets first, so only `/api/event` reaches its
script. It accepts a POST whose `Origin` header equals the request URL's own
origin, drops unknown event names and oversized bodies, adds the country (from
Cloudflare's request data), device class (mobile or desktop, from the user
agent) and host (from the request URL, never the payload), and writes one
data point. IP addresses are never stored.

Analytics Engine columns are positional (`blob1`…`blob20`, `double1`…
`double20`). One shared module, used by page and Worker, lists each event's
fields in order; it is the only place that says which column holds what. The
visit id is the index, the sampling key, so if Cloudflare samples it keeps or
drops whole visits.

## Events

Each event's fields, and the columns every event shares, are listed in
`src/telemetry/schema.ts`. Every event carries the **mode**: who drives the
map, `story` or `reader` (`src/scrollytelling/driver.ts`). While the story drives, the camera, zoom and
pinned verse belong to its author, so the same action means something
different for each. The story easing the map back counts as the story. On
`page_view` the mode is who drives as the page opens: `reader` for a link
that opens with the story folded.

| Event | Sent when |
|---|---|
| `page_view` | the page loads |
| `story_stop` | the story, driving, reaches a stop for the first time in the visit |
| `story_exit` | the reader takes the map from the story; `how` is `takeover` (acting on the map while the story is open) or `fold` (Leave story, the controls, or Back/Forward to a folded link) |
| `story_return` | the story takes the map back; `how` is `rejoin` (scrolling the story), `open` (opening the folded story) or `link` (Back/Forward or a link to a stop) |
| `view_settled` | the camera stops somewhere new while the reader drives |
| `overlay_switch` | the overlay changes |
| `search_execute` | the reader changes the search, once per term |
| `verse_click` | a verse on the map is clicked |
| `word_menu_open` | a word in the verse text is clicked |
| `word_search` | a choice in the word menu is picked |
| `sefaria_click` | the sidebar's Sefaria link is clicked |

Both story events name the stop the story is at, and are sent from the one
function in `main.ts` that changes the driver, only when it passes between
the story and the reader. Folding a story the reader already drives sends
nothing.

"Finished the story" is a `story_stop` whose number equals the total. How far
a visit got is its furthest `story_stop`. A visit opened on a link to a stop
names it in `page_view`, so it does not look like one that scrolled there.
`word_menu_open` records whether the word limit was reached, since a full
palette refuses the choice.

The centre book in `view_settled` is the book under the middle of the screen,
or the nearest one when the middle falls between books. At far zoom most of
the Tanakh is on screen and the centre book says little; analysis should group
by zoom band.

## Reading the data

`scripts/telemetry/report.sh` runs the `.sql` files beside it against the
Analytics Engine SQL API with `curl` and prints each as a table. It reads
`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (permission: Account
Analytics Read). Counts use `SUM(_sample_interval)`, which stays correct under
sampling.

## Testing

The tests are in `src/__tests__/unit/telemetry/`, and who drives, as the mode
records it, in `src/scrollytelling/__tests__/driver.test.ts`. What
they cannot reach is the live pipeline: after deploy, load the site, run the
report and find the visit.

The Worker declares the one binding method it uses, so it needs no Worker
types package.

## Out of scope

The controls inside each overlay, and the Talmud page. Filed as a follow-up.
