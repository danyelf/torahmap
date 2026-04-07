---
id: tm-lrj
status: closed
priority: 2
type: task
created: 2026-01-27
closed: 2026-01-27
---

# Refactor help system to support dynamic overlay help text

**Problem:** Help text for overlays is hardcoded in help.ts, requiring manual updates when overlays are added/changed. Currently missing haftarah and text-dating overlays.

**Solution:**
1. Add getHelpText?(): string to Overlay interface
2. Modify help.ts to dynamically build overlays tab from getAllOverlays()
3. Add help text to all 6 overlays (divine-names, commentary, trop, search, haftarah, text-dating)

**Benefits:**
- Self-documenting overlays
- No need to update help.ts when adding new overlays
- Consistent with lifecycle/configuration standardization from tm-32i
