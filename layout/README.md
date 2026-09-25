# Layout tests

These tests check that the interface fits the screen. They load the real map in headless Chromium
at four sizes (desktop, laptop, tablet, iPhone 13) and measure where the panel, controls and verse
popup land. They do not test what the map draws, what search finds or how the story reads; the
vitest suite covers those.

```bash
npm run test:layout
```

The run starts its own dev server on port 5199 (set `LAYOUT_PORT` to change it) and takes about
20 seconds. It is not part of the pre-commit hook. Run it before opening a pull request that changes
the interface.

## What a run does

For every state in `app.ts` (a URL, plus optionally a click), at every screen size, it opens the
map, takes a screenshot and checks six rules:

| Rule                 | Fails when                                                                   |
| -------------------- | ---------------------------------------------------------------------------- |
| `chrome-in-viewport` | a control or the panel sticks out past the edge of the screen                |
| `chrome-apart`       | the panel, the zoom buttons and the verse popup overlap each other           |
| `map-clear-of-panel` | the panel sits on top of the map                                             |
| `text-not-clipped`   | a label's text doesn't fit its box (ending in a deliberate `…` is fine)      |
| `touch-targets`      | on a touch screen, a button or link is under 24×24 px (WCAG 2.2 AA)          |
| `expected-shown`     | an element the state lists in `shown` is missing, hidden or cut off          |

The last rule matters because the others measure whatever their selectors find. If a redesign
renames an element, they find nothing and have nothing to report; `shown` turns that into a failure.

At the end, the run writes `layout-report/index.html`: every state at every size, side by side,
with failures marked in red. Look at it; the rules catch overlaps and clipping, not ugliness.

## Why it waits for the map to draw

The map is drawn with WebGL, which headless Chromium lacks, so the config switches on software
rendering. The tests don't check what the map shows. They wait until it has drawn something, for two
reasons: the story moves the camera and fills the panel only once the map has started, so measuring
earlier measures a half-built page; and a screenshot of a blank map would make the contact sheet
worthless for judging the layout. `the render check sees a map that drew nothing` switches drawing
off to prove that wait can't pass on a blank canvas.

## Files

- `app.ts`: the interface under test, meaning which selectors are the panel, the controls and the
  text (`CHROME`), and which states to open (`STATES`). A redesign changes this file.
- `check.ts`: the six rules, and how a result is compared with `known.ts`.
- `geometry.ts`: the box arithmetic behind the rules, with unit tests in `geometry.spec.ts`.
- `page.ts`: everything that reads from the browser. That covers waiting for the map, measuring the
  visible part of each element, finding clipped text and counting drawn pixels.
- `known.ts`: failures accepted for now. Each records why, and exactly what it measures, so a fix
  or a new failure in the same place still fails the run. `known.spec.ts` checks that every entry
  names a real state, screen and rule.
- `screens.ts`: the four screen sizes.
- `contactSheet.ts`: the reporter that writes `layout-report/`.
- `app.spec.ts`: the tests. One per state, plus checks that the rules can fail at all: a layout
  broken on purpose, and a map that drew nothing.

## When a run fails

A failure names the state, the screen and the rule, for example
`explore-search/phone/touch-targets`, and lists what it measured. Either fix the layout, or, if
the failure is accepted for now, copy the measurement into `known.ts` with the reason.
