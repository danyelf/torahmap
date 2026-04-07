---
id: tm-a1g
status: closed
priority: 0
type: bug
created: 2026-01-26
closed: 2026-01-25
---

# Add array bounds checking in Hebrew text processing

The getWordBoundaries() and mapStrippedToOriginal() functions iterate without explicit bounds checking. If verse text is malformed, these could read past array bounds.

File: src/search.ts lines 229-260, 456-489
Impact: Out-of-bounds access could cause crashes or undefined behavior
Fix: Add explicit bounds validation in text processing loops
