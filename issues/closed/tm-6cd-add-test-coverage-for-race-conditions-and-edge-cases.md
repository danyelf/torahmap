---
id: tm-6cd
status: closed
priority: 2
type: task
created: 2026-01-26
closed: 2026-01-27
---

# Add test coverage for race conditions and edge cases

Current 831 tests lack coverage for: race conditions in async overlay init, malformed verse data, URL parameter fuzzing, Hebrew text processing edge cases.

Impact: Critical bugs may not be caught before production
Fix: Add test suites for concurrency, data validation, and boundary conditions
