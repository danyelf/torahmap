---
id: tm-g9t
status: closed
priority: 2
type: task
created: 2026-01-12
closed: 2026-01-12
---

# Delete 4 duplicate test files in src/__tests__/

## Files to Delete

Four old test files duplicate newer, more comprehensive unit tests:

1. `src/__tests__/color.test.ts` (60 lines) → duplicated by `unit/utils/color.test.ts` (531 lines)
2. `src/__tests__/trop.test.ts` (112 lines) → duplicated by `unit/overlays/trop.test.ts` (1273 lines)
3. `src/__tests__/layout.test.ts` (110 lines) → duplicated by layout tests
4. `src/__tests__/search.test.ts` (94 lines) → duplicated by `unit/overlays/search.test.ts` (1122 lines)

## Impact

- Removes ~376 lines of duplicate tests
- No loss of coverage (unit tests are more comprehensive)
- Faster test runs
- Less maintenance burden

## Steps

1. Verify unit tests cover all cases from old files
2. Delete the 4 files
3. Run `npm test` to verify all tests still pass
4. Update any references (if any)

## Context

Identified in test suite audit (tm-8xb). These files appear to be from an earlier test structure that was superseded by the organized `unit/` directory structure.
