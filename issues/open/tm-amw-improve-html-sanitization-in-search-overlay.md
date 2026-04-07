---
id: tm-amw
status: open
priority: 4
type: bug
created: 2026-01-26
---

# Improve HTML sanitization in search overlay

The escapeAndHighlight() function manually escapes HTML, but uses innerHTML for injection. While currently safe (data from bundled JSON), the pattern is fragile.

File: src/overlays/search.ts lines 118-130
Impact: Potential XSS if data sources change
Fix: Use textContent + computed DOM instead of innerHTML where possible
