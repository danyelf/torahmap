---
id: tm-k8b
status: closed
priority: 4
type: bug
created: 2026-01-26
closed: 2026-01-27
---

# Add error recovery for failed data loads

If data loading fails (divine-names.json, commentary-counts.json, etc.), overlays silently become non-functional with only console errors. No fallback or retry mechanism.

Files: src/overlays/divine-names.ts lines 23-33, commentary.ts, others
Impact: Overlays fail silently leaving users confused
Fix: Add retry logic, fallback data, or user-visible error messages
