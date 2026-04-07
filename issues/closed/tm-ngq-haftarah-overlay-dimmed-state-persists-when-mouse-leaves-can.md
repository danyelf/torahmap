---
id: tm-ngq
status: closed
priority: 2
type: bug
created: 2026-01-12
closed: 2026-01-13
---

# Haftarah overlay: dimmed state persists when mouse leaves canvas

When hovering over a haftarah verse (which dims non-related verses), moving the mouse off the canvas in certain directions leaves everything dimmed instead of restoring full brightness. The mouseleave handler may not be properly clearing the hovered verse state for the overlay.
