---
id: tm-mhdo
status: open
priority: 2
type: feature
created: 2026-04-06
---

# Full-text search overlay for Talmud

Analog of the existing Tanakh full-text search (`src/search.ts` and `src/overlays/search.ts`). Hebrew-aware, nikud-insensitive, matches across the ~150-200k segment Bavli substrate (2,749 segments per tractate × 37 tractates).

Likely the single most-used overlay once the Talmud integration ships. Most users will arrive with a phrase or word in mind and want to see where it lives.

**Depends on:** `tm-f28x` (engine integration must exist before there's a substrate to search).

Discovered from tm-7la.
