---
id: tm-3pf
status: closed
priority: 2
type: bug
created: 2026-01-26
closed: 2026-01-25
---

# Optimize verse lookup in trop overlay getHoverInfo()

The getHoverInfo() function uses O(n) find() for every hover instead of using the cached lookup built by updateCache().

File: src/overlays/trop.ts lines 211-213
Impact: Hover operations slow for rare trops with many verses
Fix: Use the cachedVerseLookup Map instead of array find()
