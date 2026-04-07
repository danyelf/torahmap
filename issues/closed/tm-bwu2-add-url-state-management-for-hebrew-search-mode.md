---
id: tm-bwu2
status: closed
priority: 2
type: task
created: 2026-01-28
closed: 2026-01-27
---

# Add URL state management for Hebrew search mode

Update getUrlParams() and applyUrlParams() in overlays/search.ts to persist Hebrew mode in URL. Add mode=substring|word|root parameter. Restore mode from URL on page load.
