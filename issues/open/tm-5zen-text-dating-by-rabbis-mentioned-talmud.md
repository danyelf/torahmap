---
id: tm-5zen
status: open
priority: 3
type: feature
created: 2026-04-06
---

# Text dating by rabbis mentioned (Talmud)

Analog of the existing Tanakh text-dating overlay (`src/overlays/text-dating.ts`), using tanna/amora generations instead of source-critical periods.

Each named rabbi has a known generation:
- Tannaim: ~0–220 CE, 5 generations
- Amoraim: ~220–500 CE, 6–7 generations

The "age" of a passage is the latest rabbi it mentions. Color segments by that age. Reveals stratigraphy — late-amoraic glosses on early-tannaitic material should jump out.

**Blocked by:** `tm-aooj` (rabbinical name search) — that bead provides the name-detection infrastructure this overlay reuses for the dating computation.

Discovered from tm-7la.
