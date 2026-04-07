---
id: tm-0pr
status: closed
priority: 2
type: task
created: 2026-01-10
closed: 2026-01-09
---

# Update WebGL shaders for stipple rendering

Add color2/3/4 and colorCount vertex attributes. Fragment shader uses hash(gl_FragCoord.xy) to pick which color to display based on colorCount.
