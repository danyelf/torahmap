---
id: tm-pbe
status: closed
priority: 2
type: task
created: 2026-01-12
closed: 2026-01-12
---

# Remove interface existence tests from overlay tests

## Problem

Tests that use `typeof` to check if methods exist are redundant - TypeScript interfaces enforce this at compile time, and tests will fail anyway if methods don't exist.

## Locations

Found in multiple overlay test files:
- `unit/overlays/trop.test.ts` lines 88-100
- `unit/overlays/search.test.ts` (similar pattern)
- `unit/overlays/commentary.test.ts` (similar pattern)
- `unit/overlays/divine-names.test.ts` (similar pattern)

Example pattern to remove:
```typescript
it('implements required overlay interface methods', () => {
  expect(typeof tropOverlay.getVerseColor).toBe('function');
  expect(typeof tropOverlay.init).toBe('function');
  expect(typeof tropOverlay.destroy).toBe('function');
  // ... etc
});
```

## What to Do

1. Remove all `typeof X === 'function'` tests
2. Keep tests that verify method **behavior**
3. Estimated ~50 lines removed across all overlay tests

## Context

Identified in test suite audit (torahmap-8xb). TypeScript interfaces already enforce these requirements.
