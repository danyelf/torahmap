---
id: tm-bpu
status: closed
priority: 2
type: chore
created: 2026-01-26
closed: 2026-01-25
---

# Remove duplicate color conversion functions

Both haftarah.ts and utils/color.ts independently implement rgbToHsl() and hslToRgb(). Code duplication makes maintenance harder.

Files: src/overlays/haftarah.ts lines 63-109, src/utils/color.ts lines 50-100
Impact: Changes to one won't affect the other
Fix: Consolidate into utils/color.ts and import where needed
