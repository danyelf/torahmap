---
id: tm-io9f
status: closed
priority: 2
type: task
created: 2026-01-28
closed: 2026-01-28
---

# Register verse-length overlay in module exports

Update src/overlays/index.ts:
- Export verseLengthOverlay
- Export configure as configureVerseLength

Update src/main.ts:
- Import verseLengthOverlay and configureVerseLength
- Register verseLengthOverlay with registerOverlay()
- Call configureVerseLength({ verseTexts }) after verseTexts are loaded
