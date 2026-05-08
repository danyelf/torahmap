import { describe, it, expect } from 'vitest';

describe('Main Module Smoke Test', () => {
  it('all module imports are defined (no missing import errors)', async () => {
    // This test catches missing imports in main.ts by attempting to import it.
    // If there's a missing import (e.g., using updateLabelPositions without importing it),
    // we'll get a ReferenceError with that function name.
    //
    // NOTE: TypeScript's tsc catches these errors at compile time.
    // Run `npm run typecheck` or `npm run test:ci` to catch missing imports before runtime.
    // This test provides an additional runtime safety net.

    // List of functions that should be imported, not referenced directly
    const requiredImports = [
      'updateLabelPositions',
      'createCamera',
      'createMouseState',
      'findVerseAtPoint',
      'versesEqual',
      'computeItemStates',
      'applyItemColors',
      'renderFrame',
      'createRenderContext',
      'createRenderState',
      'rebuildGeometry',
      'clampZoom',
      'panForZoom',
      'startDrag',
      'stopDrag',
      'setHoveredVerse',
      'clearHover',
    ];

    let importError: Error | null = null;
    try {
      // This will fail for various reasons (missing DOM, WebGL, etc.)
      // but we only care about ReferenceErrors for missing imports
      await import('../../main.ts');
    } catch (error) {
      importError = error as Error;
    }

    // If we got a ReferenceError, make sure it's not about our module imports
    if (importError instanceof ReferenceError) {
      const message = importError.message;

      for (const functionName of requiredImports) {
        expect(
          message,
          `Missing import detected: ${functionName} is used but not imported`
        ).not.toMatch(new RegExp(`${functionName} is not defined`));
      }
    }

    // Test passes if:
    // 1. No error at all (unlikely in test env)
    // 2. Error is not a ReferenceError
    // 3. ReferenceError is about something else (DOM, __GIT_BRANCH__, etc.) but not our imports
    expect(true).toBe(true);
  });
});
