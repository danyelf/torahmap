---
id: tm-4nas
status: closed
priority: 2
type: bug
created: 2026-01-29
closed: 2026-02-02
---

# Fix TypeScript errors (269 total)

TypeScript strict type checking reveals 269 errors across the codebase, primarily in test files. While tests pass, these errors should be fixed to maintain type safety.

## Summary
Total errors: 269
- 267 in test files
- 2 in source files (hebrewKeyboard.ts, overlays/verse-length.ts)

## Breakdown by File (top offenders)
- src/__tests__/unit/overlays/verse-length.test.ts: 90 errors
- src/__tests__/unit/overlays/trop.test.ts: 41 errors  
- src/__tests__/unit/overlays/text-dating.test.ts: 30 errors
- src/__tests__/integration/main-initialization.test.ts: 14 errors
- src/__tests__/unit/overlays/search-lemma-indicators.test.ts: 13 errors
- src/__tests__/integration/user-workflows.test.ts: 10 errors
- src/__tests__/helpers/mocks.ts: 8 errors
- Others: 61 errors across 25 files

## Common Error Types
1. TS6133: Unused variables (e.g., 'program', 'outlineProg', 'geometry')
2. TS2339: Property does not exist on type (e.g., HTMLCollection methods)
3. TS2345: Type incompatibility in function arguments
4. TS2304: Cannot find name (undeclared variables)
5. TS2322: Type assignment incompatibility

## Source File Issues (Priority)
1. src/hebrewKeyboard.ts:28 - Unused 'inputElement' parameter
2. src/overlays/verse-length.ts:10 - Unused 'VIRIDIS_STOPS' constant

## Test Helper Issues
- src/__tests__/helpers/assertions.ts: 3 type compatibility errors
- src/__tests__/helpers/mocks.ts: 8 errors (HTMLCollection type issues, unused vars)

## Impact
- Tests pass and run correctly (all 1358 tests passing)
- Dev server and build work fine
- Type safety is compromised - may hide real issues
- Reduces IDE type inference quality

## Verification
```bash
npm run typecheck  # Shows all 269 errors
```

## Suggested Approach
1. Fix source file errors first (2 files, quick wins)
2. Fix test helper errors (assertions.ts, mocks.ts)
3. Tackle test files in order of error count
4. Consider adding typecheck to CI to prevent regression

## Notes
- Errors exist on main branch (not introduced by tm-6mw3)
- Some may be legitimate bugs caught by strict typing
- Others are likely just missing type annotations or unused code
