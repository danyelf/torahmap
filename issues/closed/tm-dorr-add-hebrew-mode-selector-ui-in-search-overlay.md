---
id: tm-dorr
status: closed
priority: 2
type: task
created: 2026-01-28
closed: 2026-01-27
---

# Add Hebrew mode selector UI in search overlay

Add radio button group in overlays/search.ts renderControls() with three options: Substring, Whole word, Root (שרש). Show for Hebrew, hide for English. Add hebrewSearchMode state variable. Wire up event handlers to re-run search on mode change.
