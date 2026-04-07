---
id: tm-jkn.4
status: closed
priority: 2
type: task
created: 2026-01-27
closed: 2026-01-27
---

# Integrate text-dating overlay into app

Wire up the text-dating overlay:
- Add to src/overlays/registry.ts
- Import getVerseDatingInfo in src/sidebar.ts
- Add dating info section to sidebar when verse is pinned
- Ensure citation links open in new tab with rel='noopener'

Test manually:
- Overlay appears in selector
- Colors render correctly
- Hover shows era and note
- Sidebar shows full info with clickable citation
- Overlay switches work correctly
