---
id: tm-f28v
status: open
priority: 3
type: feature
created: 2026-04-06
---

# Argumentation-pattern overlays for Talmud

Highlight segments containing canonical Gemara phrases. Each phrase becomes one toggle-able overlay; cheap to compute (substring match over the segment stream) and visually striking — the overlay reveals the *distribution* of that rhetorical move across a tractate.

Starter set:
- `קל וחומר` (kal v'chomer — *a fortiori* argument)
- `לא קשיא` (lo kashya — "it is not difficult", a standard dialectical move)
- Citation-introduction formulas: `תַּנְיָא`, `אִתְּמַר`, `תָּנוּ רַבָּנָן`

Potential extensions: gezerah shavah, binyan av, other hermeneutic rules. Each is a single substring match, so the cost of adding more is trivial.

**Depends on:** `tm-f28x` (engine integration).

Discovered from tm-7la.
