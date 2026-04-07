---
id: tm-bd3y
status: closed
priority: 2
type: task
created: 2026-01-28
closed: 2026-01-27
---

# Implement Hebrew whole-word search in search.ts

Add searchHebrewWholeWord() function to search.ts that matches complete Hebrew words using word boundary logic. Reuse getWordBoundaries() to find word positions. Should strip nikkud and match exact words only.
