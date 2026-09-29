# Wall prints

Two 36×24 inch prints of the map, the haftarah overlay and a search for five
names, as `docs/plans/2026-09-29-wall-print-design.md` describes.

```bash
npm run print             # scripts/print/out/: haftarah and search as .svg, .pdf, .png; proof.pdf
npm run print -- --marks  # the same, with crop marks on a slug outside the bleed
```

It needs network access for the fonts (David Libre from Google Fonts, Inter
from jsDelivr) and `pdftoppm` (Poppler) for the PNGs. The PDFs are what go to
the shop; the SVGs open in Figma, which has both faces; `proof.pdf` is a
letter page to print first, on the paper the prints will use.

To print another view, add a function beside `haftarahSheet` in `views.ts`
that returns a `SheetInput`, and call it from `print.ts`.
