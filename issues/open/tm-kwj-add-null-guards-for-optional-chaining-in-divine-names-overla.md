---
id: tm-kwj
status: open
priority: 4
type: bug
created: 2026-01-26
---

# Add null guards for optional chaining in divine-names overlay

The getVerseColor() function uses optional chaining but returns null on lookup failure instead of throwing. Silent failures could mask corrupted data files.

File: src/overlays/divine-names.ts lines 36-39
Impact: Data corruption could go undetected
Fix: Add explicit validation or throw errors on invalid data
