---
id: tm-83n
status: closed
priority: 2
type: bug
created: 2026-01-27
closed: 2026-01-27
---

# Fix labels.test.ts floating-point precision failures

20 tests in labels.test.ts are failing due to floating-point precision issues (e.g., expecting '330px' but getting '309.75px'). These are pre-existing failures on tm-jkn branch.
