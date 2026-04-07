---
id: tm-puz
status: closed
priority: 1
type: chore
created: 2026-01-26
closed: 2026-01-26
---

# Refactor global mutable state in overlays

Multiple overlays use module-level mutable state (currentCategory, selectedTrop, currentQuery) modified by multiple entry points. This creates hidden dependencies and state inconsistencies.

Files: src/overlays/commentary.ts, trop.ts, search.ts
Impact: State inconsistencies if overlays are switched/restored rapidly
Fix: Move to proper state management or encapsulate in overlay instance
