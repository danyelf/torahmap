---
id: tm-eyx
status: closed
priority: 2
type: bug
created: 2026-01-12
closed: 2026-01-12
---

# Fix empty color array bug in buildVerseGeometry

## Bug Description

When `buildVerseGeometry` receives a verse with an empty color array `[]`, it produces NaN values in the output buffer.

## Location

`src/geometry.ts` - `buildVerseGeometry` function

## Test That Reveals Bug

`unit/geometry.test.ts` lines 562-572:
```typescript
it('handles zero-width color arrays', () => {
  const verse = createVerse({ color: [] as any });
  const buffer = buildVerseGeometry([verse]);
  // Currently produces NaN!
  expect(isNaN(buffer[colorOffset])).toBe(true);
});
```

## Expected Behavior

Empty color array should:
- Fall back to default base color [0.6, 0.6, 0.6]
- OR throw a clear error
- NOT produce NaN values

## Impact

- Could cause rendering issues if empty arrays reach this code
- Currently a latent bug (may not be triggered in production)

## Fix

Add validation for empty color arrays at the start of the function:
```typescript
if (Array.isArray(verse.color) && verse.color.length === 0) {
  // Handle empty array case
}
```

## Context

Identified in test suite audit (torahmap-8xb). Good example of a test revealing a real bug!
