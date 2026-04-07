---
id: tm-wnv
status: open
priority: 4
type: bug
created: 2026-01-26
---

# Add validation for URL parameters

Zoom and pan values are parsed but only roughly validated. Malformed URLs with special characters in verse format could be partially parsed and cause unexpected behavior.

File: src/urlState.ts lines 52-58, 160-181
Impact: Could cause app instability or XSS via URL injection
Fix: Add comprehensive input validation and sanitization for all URL parameters
