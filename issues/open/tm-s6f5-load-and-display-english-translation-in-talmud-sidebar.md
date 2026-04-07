---
id: tm-s6f5
status: open
priority: 2
type: feature
created: 2026-04-06
---

# Load and display English translation in Talmud sidebar / hover

Sefaria-Export's bucket includes English versions for Bavli tractates (e.g. William Davidson English at `gs://sefaria-export/json/Talmud/Bavli/<Seder>/<Tractate>/English/`). The main app's sidebar already shows Hebrew + English for Tanakh verses; the Talmud integration should do the same for segments.

The tm-7la prototype intentionally only loaded Hebrew Wikisource because char-count was the only signal it needed for the segment-length overlay. Production needs both languages.

Discovered from tm-7la.
