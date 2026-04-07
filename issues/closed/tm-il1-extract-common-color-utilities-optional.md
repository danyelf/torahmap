---
id: tm-il1
status: closed
priority: 4
type: task
created: 2026-01-27
closed: 2026-01-27
---

# Extract common color utilities (optional)

**Observation:** Multiple overlays implement similar color interpolation logic:
- src/utils/color.ts:21-42 (heatmapColor)
- src/overlays/text-dating.ts:72-88 (gradient with shading)
- src/overlays/trop.ts:60-84 (multi-tier gradient)

**Solution (optional):**
Create shared utilities:
- interpolateColorGradient(t: number, stops: Color[]): Color
- scaleToGradient(value: number, maxValue: number, gradient: Color[]): Color

**Note:** This is an optimization, not critical. Only do if adding more overlays with similar needs.
