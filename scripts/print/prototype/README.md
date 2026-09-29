# Wall print prototype

The code that drew the mockups in
`docs/plans/2026-09-29-wall-print-design.md`. It is the starting point for
`scripts/print/`, and goes when that script replaces it.

- `dump-haftarah.ts` and `dump-search.ts` write every verse's position (Psalms
  in three columns only in the haftarah dump) and its readings or names, as
  JSON.
- `layoutC-template.html` draws the agreed haftarah sheet as SVG in the
  browser: verses, split bands, titles, logo, key. `search-template.html` draws
  the search palette comparison.
- `build.mjs` puts a dump into a template.

```bash
node scripts/print/prototype/dump-haftarah.ts /tmp/haftarah.json
node scripts/print/prototype/build.mjs scripts/print/prototype/layoutC-template.html /tmp/haftarah.json /tmp/layout.html
open /tmp/layout.html
```

The pages were written for the brainstorming viewer, so outside it the cards
are unstyled; the drawing is the same. Split bands are drawn without the slide
along the cut that `BAND_OFFSET` now adds.
