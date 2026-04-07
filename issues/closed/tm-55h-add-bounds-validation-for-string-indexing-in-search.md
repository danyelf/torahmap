---
id: tm-55h
status: closed
priority: 4
type: bug
created: 2026-01-26
closed: 2026-01-27
---

# Add bounds validation for string indexing in search

The search() function does string indexing without validation that origEnd <= text.length, which could cause issues with malformed verse data.

File: src/search.ts lines 162-165
Impact: Potential crashes or undefined behavior with bad data
Fix: Add explicit bounds checking before string operations
