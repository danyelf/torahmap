---
id: tm-jkn.3
status: closed
priority: 2
type: task
created: 2026-01-27
closed: 2026-01-27
---

# Implement text-dating overlay and styles

Create src/overlays/text-dating.ts implementing the Overlay interface:
- Load text-dating.json on init
- Implement getVerseColor with geological colors and date-based shading
- Implement getHoverInfo showing era, date, and note
- Implement renderLegend with 5 era swatches
- Export getVerseDatingInfo for sidebar integration

Create src/styles/overlays/text-dating.css for:
- Legend styling (era swatches, labels)
- Sidebar dating-info section styling
- Consistent with existing overlay styles

Follows established patterns from commentary.ts and divine-names.ts.
