---
id: tm-u6q
status: open
priority: 4
type: bug
created: 2026-01-26
---

# Add defensive checks for layout computation

The layout algorithm makes assumptions about verse array ordering and positioning without defensive checks. If data is corrupted or loaded incorrectly, verses could be positioned outside computed bounds.

File: src/layout.ts throughout chapter/book layout
Impact: Could cause rendering artifacts or out-of-bounds WebGL access
Fix: Add bounds validation and defensive checks in layout algorithm
