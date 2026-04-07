---
id: tm-863
status: closed
priority: 3
type: task
created: 2026-01-12
closed: 2026-01-12
---

# Consolidate redundant tests in random.test.ts

## Problem

Two tests check the same deterministic behavior:

1. "returns deterministic values for the same seed" (lines 12-20)
2. "is consistent with the original implementation" (lines 115-133)

Both verify that `seededRandom(seed)` returns the same value each time.

## What to Do

- Keep the first test (simpler, clearer intent)
- Remove the second test
- Estimated ~20 lines removed

## Location

`src/__tests__/unit/utils/random.test.ts` lines 115-133

## Context

Identified in test suite audit (torahmap-8xb).
