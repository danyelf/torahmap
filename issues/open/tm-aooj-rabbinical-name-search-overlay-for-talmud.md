---
id: tm-aooj
status: open
priority: 2
type: feature
created: 2026-04-06
---

# Rabbinical name search overlay for Talmud

Distinct from general full-text search because rabbinical references follow stereotyped forms (`רַב`, `רַבִּי`, `ר׳`, `רבא`, `רב יהודה`, etc.) and are a first-class analytical interest in Talmud study. Given a name or name-pattern, highlight every segment that mentions it.

This is also the foundation for the "text dating by rabbis mentioned" overlay (`tm-5zen`) — that bead reuses the name-detection infrastructure.

**Depends on:** `tm-f28x` (engine integration).

Discovered from tm-7la.
