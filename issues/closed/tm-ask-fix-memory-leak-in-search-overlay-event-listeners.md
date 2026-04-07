---
id: tm-ask
status: closed
priority: 0
type: bug
created: 2026-01-26
closed: 2026-01-25
---

# Fix memory leak in search overlay event listeners

The search overlay registers a document-level click handler in renderControls() but has a race condition in cleanup. If an overlay is switched away and back to search without proper cleanup, duplicate listeners accumulate.

File: src/overlays/search.ts lines 305-311, 357-367
Impact: Memory leaks and duplicate event handling
Fix: Ensure documentClickHandler is properly removed before registering a new one
