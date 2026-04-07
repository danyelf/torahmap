---
id: tm-u7b1
status: open
priority: 2
type: task
created: 2026-04-06
---

# Verify Wikisource coverage across all Bavli tractates

Gating check for the full-Bavli engine integration (`tm-f28x`). For each of 37 Bavli tractates, download the Wikisource Hebrew JSON from `gs://sefaria-export/json/Talmud/Bavli/<Seder>/<Tractate>/Hebrew/Wikisource Talmud Bavli.json` and verify:

1. Segment counts are non-zero and roughly match expected sizes
2. `מתני׳` and `גמ׳` marker counts are plausible (~30-100 per tractate)
3. The shape matches Davidson's `merged.json` (same `text.length`, same per-amud segment counts) so position-based addressing works on either source

The tm-7la exploration verified Berakhot is complete. Wikisource is known to be patchy for some Sefaria texts in general, so per-tractate verification is the precondition for committing to Wikisource as the data source.

**Reference:** `docs/plans/2026-04-06-talmud-exploration-design.md` §4.

Discovered from tm-7la.
