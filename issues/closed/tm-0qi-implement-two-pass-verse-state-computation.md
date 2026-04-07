---
id: tm-0qi
status: closed
priority: 2
type: task
created: 2026-01-25
closed: 2026-01-25
---

# Implement two-pass verse state computation

Create VerseState interface and computeVerseStates() function. First pass computes semantic state (hasOverlayColor, baseColor, isHovered, isPinned). Abstract getDefaultColor() and getOverlayColor() helpers. Refactor applyOverlay() to use computed state array.
