# Test Infrastructure Design

## Overview

Add unit and integration tests to Torah Map using Vitest, ensuring the core logic doesn't break during future development.

## Framework Choice

**Vitest** - Native Vite integration, fast execution, TypeScript support out of box.

## Test Structure

```
src/__tests__/
├── layout.test.ts           # Unit tests for layout functions
├── trop.test.ts             # Unit tests for trop parsing
├── search.test.ts           # Unit tests for search utilities
├── color.test.ts            # Unit tests for color utilities
└── integration/
    └── layout.integration.test.ts  # Property-based layout verification
```

## Unit Tests

### layout.test.ts

| Function | Test Cases |
|----------|------------|
| `calculateWrapPoints(30)` | Returns `[30]` (no wrap) |
| `calculateWrapPoints(52)` | Returns `[49, 3]` (avoids widow) |
| `calculateWrapPoints(150)` | Returns `[50, 50, 50]` |
| `seededRandom(n)` | Deterministic output for same seed |
| `getSection('Genesis')` | Returns `'torah'` |
| `getSection('Isaiah')` | Returns `'neviim'` |
| `getSection('Psalms')` | Returns `'ketuvim'` |

### trop.test.ts

| Function | Test Cases |
|----------|------------|
| `extractTropMarks(text)` | Extracts tipcha (U+0596) from Hebrew text |
| `countTropMarks(text)` | Counts multiple marks correctly |
| `getRarityTier(10)` | Returns `'rare'` |
| `getRarityTier(200)` | Returns `'uncommon'` |
| `getRarityTier(1000)` | Returns `'common'` |

### search.test.ts

| Function | Test Cases |
|----------|------------|
| `stripNikkud('בְּרֵאשִׁית')` | Returns `'בראשית'` |
| `isHebrewQuery('בראשית')` | Returns `true` |
| `isHebrewQuery('genesis')` | Returns `false` |

### color.test.ts

| Function | Test Cases |
|----------|------------|
| `heatmapColor(0, 100)` | Returns dark color |
| `heatmapColor(100, 100)` | Returns hot color |
| Color values | All in [0, 1] range |

## Integration Tests

### layout.integration.test.ts

Property-based verification of the full layout algorithm:

1. **Verse count** - Total equals 23,145 (Tanakh total)
2. **Determinism** - Running twice produces identical output
3. **Section ordering** - Torah Y < Nevi'im Y < Ketuvim Y
4. **Book structure** - Each section contains expected books
5. **No overlaps** - No two verses share same position
6. **Psalm 119** - 176 verses wraps to 4 lines correctly

## Code Changes

Export internal functions for testing:

- `layout.ts`: Export `calculateWrapPoints`, `getSection`
- `search.ts`: Export `stripNikkud`, `isHebrewQuery`

## npm Scripts

```json
{
  "test": "vitest run",
  "test:watch": "vitest"
}
```
