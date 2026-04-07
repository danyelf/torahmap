---
id: tm-dk9d
status: open
priority: 3
type: feature
created: 2026-04-06
---

# Cross-reference overlay: Talmud → Torah with verse-color gradient

Highlight Bavli segments that quote or reference the Torah, coloring each highlighted segment by the **location** of the cited Torah verse: early-Genesis citations get one color, late-Deuteronomy citations another (continuous gradient over the ~5,800 Torah verses).

This turns the Bavli visualization into a distribution plot of "which parts of the Bavli draw from which parts of the Torah." Likely to reveal interesting structure — perakim that focus on a particular biblical narrative will glow with one color band; halakhic discussions will sample more uniformly.

Data source: Sefaria's links CSVs (`gs://sefaria-export/links/links*.csv`), filtered to source category Bavli and target category Torah.

**Depends on:** `tm-f28x` (engine integration).

Discovered from tm-7la.
