---
id: tm-alw
status: closed
priority: 3
type: feature
created: 2026-01-27
closed: 2026-01-27
---

# Add Escape key to close/unpin verse sidebar

Add keyboard shortcut (Escape) to unpin/close the verse sidebar.

Current state:
- Arrow keys navigate between verses (already implemented)
- No keyboard shortcut to close the sidebar
- Only way to unpin is clicking the X button or clicking empty space

Expected behavior:
- Press Escape to unpin the current verse and close sidebar
- Standard UX pattern that users expect
- Improves keyboard navigation workflow

Implementation:
- Add keydown event listener for Escape key
- Call unpinVerse() when sidebar is visible/pinned
- ~5 lines of code in main.ts

Benefits:
- Better keyboard accessibility
- Matches standard UI conventions
- Quick polish with minimal effort
