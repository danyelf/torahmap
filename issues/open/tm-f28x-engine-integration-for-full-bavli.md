---
id: tm-f28x
status: open
priority: 2
type: feature
created: 2026-04-06
---

# Engine integration for full Bavli

Wire the Talmud-engine pipeline (worked out in the tm-7la exploration) into the main app behind a corpus flag (e.g. `?corpus=talmud`). Reuse `computeTalmudLayout` via code-lift from the design doc, not as an import — the prototype was throwaway. Handle multi-tractate layout, Mishnah/Gemara as a first-class overlay, daf labels as a sparse reveal.

**Blocked by:** `tm-u7b1` (Verify Wikisource coverage across all Bavli tractates) — needs to confirm the data source actually has all 37 tractates before we wire them in.

**Reference:** `docs/plans/2026-04-06-talmud-exploration-design.md`, `docs/plans/2026-04-06-talmud-exploration-memo.md`. The memo's "Recommendation" section spells out what "yes, pursue" means in concrete terms.

Discovered from tm-7la.
