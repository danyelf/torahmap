---
id: tm-gko1
status: open
priority: 4
type: feature
created: 2026-04-06
---

# Commentary-link-count overlay for Talmud

Port the existing Tanakh commentary heatmap (`src/overlays/commentary.ts`) to the Talmud, using Sefaria's links data (`gs://sefaria-export/links/links*.csv`) to count how many commentary references each Talmud segment has. Adds analytical substrate depth — busy segments (heavily-commented ones) stand out as heat.

The Talmud has its own rich commentary tradition (Rashi, Tosafot, Maharsha, etc.) which Sefaria has indexed extensively, so the heatmap should be even more informative than for the Tanakh.

**Depends on:** `tm-f28x` (engine integration).

Discovered from tm-7la.
