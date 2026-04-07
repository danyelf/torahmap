---
id: tm-b5x
status: closed
priority: 2
type: chore
created: 2026-01-26
closed: 2026-01-26
---

# Document and extract magic numbers to constants

Magic numbers appear throughout the codebase without explanation: VERSE_SIZE=6, CHAPTER_GAP=2, zoomFactor 0.9/1.1, min search length 2, etc.

Files: src/layout.ts, src/main.ts, src/search.ts
Impact: Hard to debug or adjust parameters
Fix: Extract to named constants with documentation explaining choices
