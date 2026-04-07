---
id: tm-2a8
status: closed
priority: 3
type: task
created: 2026-01-12
closed: 2026-01-12
---

# Remove passthrough and meta-testing tests from webgl.test.ts

## Problems

### 1. Passthrough Tests (lines 614-633)

Tests that verify functions return exactly what WebGL APIs return - no logic to test:
```typescript
it('handles attribute location -1 (not found)', () => {
  gl.getAttribLocation = vi.fn(() => -1);
  const program = createProgram(gl);
  expect(program.attribs.position).toBe(-1); // Just checking passthrough
});
```

### 2. Meta-Testing (lines 550-584)

Test that verifies only specific functions were called - tests the test, not the code:
```typescript
it('only creates shaders and program objects', () => {
  const allowedFunctions = ['createShader', 'shaderSource', ...];
  // Checks that only these functions were called
});
```

## What to Do

1. Remove or consolidate passthrough tests into a single error handling test
2. Remove meta-testing test completely
3. Keep tests that verify actual behavior and error handling

## Impact

- Reduces brittle tests
- Focuses on behavior over implementation details
- Estimated ~50 lines removed

## Context

Identified in test suite audit (tm-8xb).
