---
id: tm-dab
status: closed
priority: 2
type: task
created: 2026-01-27
closed: 2026-01-27
---

# Consolidate duplicate constants

**Problem:** HIGHLIGHT_COLOR and DIM_FACTOR are defined in both constants.ts and utils/color.ts, violating DRY and single source of truth.

**Files:**
- src/constants.ts:24,36,39
- src/utils/color.ts:5-6

**Solution:**
1. Keep constants in src/constants.ts (already has HIGHLIGHT_CONSTANTS namespace)
2. Remove duplicates from utils/color.ts
3. Update imports throughout codebase
4. Ensure SEARCH_COLORS stays in utils/color.ts (color-specific, not general constant)
