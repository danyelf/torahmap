---
id: tm-6db
status: closed
priority: 3
type: feature
created: 2026-01-12
closed: 2026-01-13
---

# Add integration tests for real user workflows

## Missing Test Coverage

Despite excellent unit test coverage, we lack integration tests for multi-step user interactions.

## Test Scenarios to Add

### 1. Multi-step Interaction Flows
- Click verse → change overlay → zoom → search → verify state
- Switch overlays multiple times → verify no state leakage
- Deep zoom → pan → reset → verify correct state

### 2. State Persistence
- Change overlay + zoom + verse → refresh page → verify URL restored state
- Full interaction cycle → verify URL stays in sync
- Browser back/forward → verify state changes correctly

### 3. Performance/Scale
- Render all 23,000 verses → measure time
- Switch overlays 10 times → verify no memory leaks
- Deep zoom with many verses visible → verify frame rate

### 4. Edge Cases
- Rapid overlay switching (stress test)
- Very long search queries (1000+ chars)
- Extreme zoom levels (0.1x, 10x)

## Implementation Notes

- Use `describe('Integration Tests')` block
- Consider using Playwright/Cypress for end-to-end tests
- Add performance benchmarks with thresholds

## Context

Identified in test suite audit (torahmap-8xb). Unit tests are excellent, but we need confidence in full user journeys.
