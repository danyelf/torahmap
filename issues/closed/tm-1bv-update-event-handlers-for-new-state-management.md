---
id: tm-1bv
status: closed
priority: 2
type: task
created: 2026-01-25
closed: 2026-01-25
---

# Update event handlers for new state management

Refactor mousemove, mouseleave, mousedown, mouseup handlers to use mouseState object. Ensure hover changes trigger re-render even when overlay doesn't care. Clear mouseState.hoveredVerse on mouseleave and trigger re-render.
