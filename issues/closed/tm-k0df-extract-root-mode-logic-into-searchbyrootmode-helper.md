---
id: tm-k0df
status: closed
priority: 2
type: task
created: 2026-01-28
closed: 2026-01-27
---

# Extract root mode logic into searchByRootMode() helper

Extract existing lemma search logic (lines 285-368 in search.ts) into a separate searchByRootMode() function. Change fallback from substring to whole-word search when lemma not found.
