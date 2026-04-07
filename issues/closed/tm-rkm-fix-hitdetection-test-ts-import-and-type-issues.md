---
id: tm-rkm
status: closed
priority: 2
type: task
created: 2026-01-26
closed: 2026-01-26
---

# Fix hitDetection.test.ts import and type issues

hitDetection tests have import/type issues after Verse -> VerseLayout refactoring.

Location: src/__tests__/unit/hitDetection.test.ts

The bulk find/replace may have missed some patterns. Need to verify all:
- Imports are correct (VerseLayout not Verse)
- Type annotations are updated
- Test helpers are compatible

Current failures: ~7 tests in hitDetection.test.ts
