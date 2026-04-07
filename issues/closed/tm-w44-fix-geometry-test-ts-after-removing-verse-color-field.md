---
id: tm-w44
status: closed
priority: 2
type: task
created: 2026-01-26
closed: 2026-01-26
---

# Fix geometry.test.ts after removing Verse.color field

The buildVerseGeometry tests expect verses to have a color field, but we removed it in the refactoring. Tests need to be updated to pass colors as a separate parameter array. 

Location: src/__tests__/unit/geometry.test.ts

Changes needed:
- Update test helper createVerse() to not include color field
- Update all buildVerseGeometry() calls to pass colors separately: buildVerseGeometry(verses, colors)
- Tests in 'color handling' sections need the most work

Current failures: ~22 tests in geometry.test.ts
