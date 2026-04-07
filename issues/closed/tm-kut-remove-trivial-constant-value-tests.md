---
id: tm-kut
status: closed
priority: 2
type: task
created: 2026-01-12
closed: 2026-01-12
---

# Remove trivial constant value tests

## Problem

Tests that verify constants equal their defined values don't catch bugs - TypeScript already ensures type safety.

## Locations

- `unit/utils/color.test.ts` lines 16-54 (constant tests for HIGHLIGHT_COLOR, DIM_FACTOR, SEARCH_COLORS)

Examples:
```typescript
it('is bright cyan as documented', () => {
  expect(HIGHLIGHT_COLOR).toEqual([0.2, 0.9, 1.0]);
});
it('is a valid dimming factor', () => {
  expect(DIM_FACTOR).toBe(0.3);
});
```

## What to Keep

- Tests that validate colors are in valid RGB ranges [0,1] (runtime validation)
- Tests that verify constants work correctly in context

## What to Remove

- Tests that just check constant === literal value
- Estimated ~40 lines removed

## Context

Identified in test suite audit (torahmap-8xb). These tests provide no additional confidence beyond TypeScript's compile-time checks.
