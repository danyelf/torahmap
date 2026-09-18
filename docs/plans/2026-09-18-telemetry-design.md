# Telemetry Design

**Date:** 2026-09-18
**Status:** Approved, being implemented. Issue #213.

## Problem

We want to know how the map is used: whether people read the story, how far
they get, where they go once they are free, and what they do in explore mode.
Today the page loads Google Analytics 4, which records none of the story, sets
cookies (so EU visitors may need a consent banner we do not have), and counts
visits from the dev server alongside real ones.

## Decisions

- **Google Analytics is removed.** Events go to Cloudflare Workers Analytics
  Engine through the site's own Worker. No cookies, nothing stored in the
  browser, no third party.
- **Analytics Engine keeps three months of data.** Accepted for now. D1 is
  built for read-heavy work, Pipelines needs the Workers Paid plan, and one R2
  object per event needs a compaction job; Honeycomb's free tier keeps 60 days.
- **Only `torahmap.org` sends.** The dev server, `workers.dev` and previews
  send nothing.
- **No dashboard yet.** A script runs saved SQL queries and prints tables.
  Cloudflare Web Analytics (the page-view beacon) was considered and left out:
  it has no custom events.

## How an event travels

The page posts JSON to `/api/event` with `navigator.sendBeacon`. Each page
load draws a random visit id held only in memory, so a visit's events can be
grouped without storing anything on the device.

The Worker serves static assets first, so only `/api/event` reaches its
script. It accepts a POST whose `Origin` is `https://torahmap.org`, drops
unknown event names and oversized bodies, adds the country (from Cloudflare's
request data) and device class (mobile or desktop, from the user agent), and
writes one data point. IP addresses are never stored.

Analytics Engine columns are positional (`blob1`…`blob20`, `double1`…
`double20`). One shared module, used by page and Worker, lists each event's
fields in order; it is the only place that says which column holds what. The
visit id is the index, the sampling key, so if Cloudflare samples it keeps or
drops whole visits.

## Events

Every event carries the visit id, country, device and **mode** (story or
explore). In story mode the camera, zoom and pinned verse belong to the
story's author, so the same action means something different in each mode.

| Event | Fields | Sent when |
|---|---|---|
| `page_view` | mode, story stop named in the URL, referrer's domain | the page loads |
| `story_stop` | stop id, stop number, total stops | a stop is reached for the first time in the visit |
| `story_exit` | stop id, stop number | "Explore freely" is pressed |
| `story_return` | stop id | "Back to story" is pressed |
| `view_settled` | centre book, section (Torah, Nevi'im, Ketuvim), zoom band, zoom | the camera stops moving, in explore mode only |
| `overlay_switch` | overlay, previous overlay | as before |
| `search_execute` | term (first 40 characters), language, search mode (substring, word, root), result count | as before |
| `verse_click` | book, chapter, verse | as before |
| `word_menu_open` | word, verse, meanings offered, five-word limit reached | a word in the verse text is clicked |
| `word_search` | word, choice (a meaning, or the exact spelling), verse | a choice in the word menu is picked |
| `sefaria_click` | book, chapter, verse, current overlay | the sidebar's Sefaria link is clicked |

"Finished the story" is a `story_stop` whose number equals the total. How far
a visit got is its furthest `story_stop`. A visit opened on a link to a stop
names it in `page_view`, so it does not look like one that scrolled there.

`view_settled` replaces `zoom_level`. The centre book is the book under the
middle of the screen, or the nearest one when the middle falls between books.
At far zoom most of the Tanakh is on screen and the centre book says little;
analysis should group by zoom band.

## Reading the data

`scripts/telemetry/report.sh` runs the `.sql` files beside it against the
Analytics Engine SQL API with `curl` and prints each as a table: visits per
day, story reach by stop, where people leave the story, overlay use, top
searches and word searches, Sefaria clicks. It reads `CLOUDFLARE_ACCOUNT_ID`
and `CLOUDFLARE_API_TOKEN` (permission: Account Analytics Read). Counts use
`SUM(_sample_interval)`, which stays correct under sampling.

## Testing

- Worker: rejects the wrong origin, unknown events and oversized bodies; maps
  fields to the right columns, against a fake binding.
- Page: sends nothing off `torahmap.org`; sends each story stop once per
  visit.
- `wrangler dev`: `/api/event` reaches the script and static assets still
  load. The real check is after deploy: load the site, run the report, find
  the visit.

Worker types come from `wrangler types`, not a new dependency.

## Out of scope

The controls inside each overlay, and the Talmud page. Filed as a follow-up.
