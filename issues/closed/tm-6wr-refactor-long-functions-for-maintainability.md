---
id: tm-6wr
status: closed
priority: 3
type: task
created: 2026-01-27
closed: 2026-01-27
---

# Refactor long functions for maintainability

**Functions to break down:**

1. src/main.ts:262-294 buildCurrentUrlState (33 lines)
   - Extract overlay param building to separate function

2. src/main.ts:468-516 restoreFromUrl (49 lines)
   - Extract verse restoration logic
   - Extract overlay restoration logic

3. src/overlays/search.ts:157-262 highlightSearchTerms (106 lines)
   - Extract match finding
   - Extract highlighting/DOM building

**Goal:** Single-purpose functions that are easier to test and understand
