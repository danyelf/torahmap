---
id: tm-go93
status: open
priority: 4
type: task
created: 2026-04-06
---

# Explore alternative layout schemes for Talmud

The tm-7la option C (perek-as-vertical-block, amud-per-row) is one point in a large design space. Other layouts worth prototyping after the integration ships:

- **Daf-as-tile grid**: one tile per daf, perek as a colored frame around groups of tiles. Better navigability for daf-yomi readers.
- **Sugya-as-unit**: each sugya becomes the atom. Requires sugya-boundary inference, which is its own research project — Sefaria doesn't mark sugya boundaries.
- **Seder-level mosaic**: tractates tile hexagonally or as a compact treemap, sized by segment count. For viewing the whole Bavli at once.
- **Ladder layout**: amudim as columns instead of rows. Perakim as horizontal sections.

Low-priority exploration — only after the integration (`tm-f28x`) and core overlays are stable. Each is a small prototype, similar in scope to tm-7la itself.

Discovered from tm-7la.
