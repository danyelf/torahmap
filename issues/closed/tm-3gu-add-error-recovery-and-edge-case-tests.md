---
id: tm-3gu
status: closed
priority: 3
type: feature
created: 2026-01-12
closed: 2026-01-13
---

# Add error recovery and edge case tests

## Missing Test Coverage

Need tests for error conditions and recovery scenarios.

## Test Scenarios to Add

### 1. Network Failures
- Verse texts fail to load → show error message
- Partial data loaded → handle gracefully
- Timeout scenarios → retry or fail gracefully

### 2. Malformed Data
- Invalid JSON in verse texts → catch and report
- Missing required fields → use defaults or error
- Corrupted structure data → fallback behavior

### 3. Browser Compatibility
- No WebGL2 support → show clear error message
- Canvas creation fails → graceful degradation
- Low memory conditions → handle allocation failures

### 4. Invalid User Input
- Malformed URLs with invalid parameters
- Search queries with special regex characters
- Invalid verse references in URL

### 5. Resource Exhaustion
- Very large overlay data → handle memory limits
- Hundreds of search results → pagination or limiting
- Rapid repeated actions → debouncing/throttling

## Implementation Notes

- Add error boundary tests
- Mock network failures with vitest
- Test recovery paths, not just error detection

## Context

Identified in test suite audit (torahmap-8xb). Current tests focus on happy paths.
