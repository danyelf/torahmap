import { describe, it, expect } from 'vitest';
import {
  createMouseState,
  startDrag,
  stopDrag,
  setHoveredVerse,
  clearHover,
} from '../../mouseState';
import type { VerseLayout } from '../../types';
import { versesEqual } from '../../types';

describe('mouseState', () => {
  describe('createMouseState', () => {
    it('creates initial state with no interaction', () => {
      const state = createMouseState();

      expect(state.isDragging).toBe(false);
      expect(state.hoveredVerse).toBe(null);
      expect(state.dragStart).toEqual({ x: 0, y: 0 });
    });

    it('creates independent state objects', () => {
      const state1 = createMouseState();
      const state2 = createMouseState();

      state1.isDragging = true;
      expect(state2.isDragging).toBe(false);
    });
  });

  describe('versesEqual', () => {
    it('returns true when both are null', () => {
      expect(versesEqual(null, null)).toBe(true);
    });

    it('returns false when only first is null', () => {
      const verse: VerseLayout = {
        book: 'Genesis',
        chapter: 1,
        verse: 1,
        x: 0,
        y: 0,
        size: 1,
      };
      expect(versesEqual(null, verse)).toBe(false);
    });

    it('returns false when only second is null', () => {
      const verse: VerseLayout = {
        book: 'Genesis',
        chapter: 1,
        verse: 1,
        x: 0,
        y: 0,
        size: 1,
      };
      expect(versesEqual(verse, null)).toBe(false);
    });

    it('returns true when verses are the same', () => {
      const verse1: VerseLayout = {
        book: 'Genesis',
        chapter: 1,
        verse: 1,
        x: 0,
        y: 0,
        size: 1,
      };
      const verse2: VerseLayout = {
        book: 'Genesis',
        chapter: 1,
        verse: 1,
        x: 100,  // Different position - doesn't matter
        y: 200,
        size: 2,
      };
      expect(versesEqual(verse1, verse2)).toBe(true);
    });

    it('returns false when books differ', () => {
      const verse1: VerseLayout = {
        book: 'Genesis',
        chapter: 1,
        verse: 1,
        x: 0,
        y: 0,
        size: 1,
      };
      const verse2: VerseLayout = {
        book: 'Exodus',
        chapter: 1,
        verse: 1,
        x: 0,
        y: 0,
        size: 1,
      };
      expect(versesEqual(verse1, verse2)).toBe(false);
    });

    it('returns false when chapters differ', () => {
      const verse1: VerseLayout = {
        book: 'Genesis',
        chapter: 1,
        verse: 1,
        x: 0,
        y: 0,
        size: 1,
      };
      const verse2: VerseLayout = {
        book: 'Genesis',
        chapter: 2,
        verse: 1,
        x: 0,
        y: 0,
        size: 1,
      };
      expect(versesEqual(verse1, verse2)).toBe(false);
    });

    it('returns false when verse numbers differ', () => {
      const verse1: VerseLayout = {
        book: 'Genesis',
        chapter: 1,
        verse: 1,
        x: 0,
        y: 0,
        size: 1,
      };
      const verse2: VerseLayout = {
        book: 'Genesis',
        chapter: 1,
        verse: 2,
        x: 0,
        y: 0,
        size: 1,
      };
      expect(versesEqual(verse1, verse2)).toBe(false);
    });
  });

  describe('startDrag', () => {
    it('sets isDragging to true', () => {
      const state = createMouseState();
      startDrag(state, 100, 200);

      expect(state.isDragging).toBe(true);
    });

    it('stores drag start position', () => {
      const state = createMouseState();
      startDrag(state, 100, 200);

      expect(state.dragStart).toEqual({ x: 100, y: 200 });
    });

    it('updates position on subsequent calls', () => {
      const state = createMouseState();
      startDrag(state, 100, 200);
      startDrag(state, 300, 400);

      expect(state.dragStart).toEqual({ x: 300, y: 400 });
    });
  });

  describe('stopDrag', () => {
    it('sets isDragging to false', () => {
      const state = createMouseState();
      state.isDragging = true;

      stopDrag(state);

      expect(state.isDragging).toBe(false);
    });
  });

  describe('setHoveredVerse', () => {
    it('sets hovered verse', () => {
      const state = createMouseState();
      const verse: VerseLayout = {
        book: 'Genesis',
        chapter: 1,
        verse: 1,
        x: 0,
        y: 0,
        size: 1,
      };

      setHoveredVerse(state, verse);

      expect(state.hoveredVerse).toBe(verse);
    });

    it('can set to null', () => {
      const state = createMouseState();
      const verse: VerseLayout = {
        book: 'Genesis',
        chapter: 1,
        verse: 1,
        x: 0,
        y: 0,
        size: 1,
      };
      state.hoveredVerse = verse;

      setHoveredVerse(state, null);

      expect(state.hoveredVerse).toBe(null);
    });

    it('can change from one verse to another', () => {
      const state = createMouseState();
      const verse1: VerseLayout = {
        book: 'Genesis',
        chapter: 1,
        verse: 1,
        x: 0,
        y: 0,
        size: 1,
      };
      const verse2: VerseLayout = {
        book: 'Genesis',
        chapter: 1,
        verse: 2,
        x: 10,
        y: 0,
        size: 1,
      };

      setHoveredVerse(state, verse1);
      expect(state.hoveredVerse).toBe(verse1);

      setHoveredVerse(state, verse2);
      expect(state.hoveredVerse).toBe(verse2);
    });
  });

  describe('clearHover', () => {
    it('clears isDragging', () => {
      const state = createMouseState();
      state.isDragging = true;

      clearHover(state);

      expect(state.isDragging).toBe(false);
    });

    it('clears hoveredVerse', () => {
      const state = createMouseState();
      const verse: VerseLayout = {
        book: 'Genesis',
        chapter: 1,
        verse: 1,
        x: 0,
        y: 0,
        size: 1,
      };
      state.hoveredVerse = verse;

      clearHover(state);

      expect(state.hoveredVerse).toBe(null);
    });

    it('clears both dragging and hover', () => {
      const state = createMouseState();
      const verse: VerseLayout = {
        book: 'Genesis',
        chapter: 1,
        verse: 1,
        x: 0,
        y: 0,
        size: 1,
      };
      state.isDragging = true;
      state.hoveredVerse = verse;

      clearHover(state);

      expect(state.isDragging).toBe(false);
      expect(state.hoveredVerse).toBe(null);
    });
  });

  describe('integration', () => {
    it('supports typical drag workflow', () => {
      const state = createMouseState();

      // Start drag
      startDrag(state, 100, 200);
      expect(state.isDragging).toBe(true);
      expect(state.dragStart).toEqual({ x: 100, y: 200 });

      // Update drag position (simulating mousemove)
      state.dragStart = { x: 150, y: 250 };

      // Stop drag
      stopDrag(state);
      expect(state.isDragging).toBe(false);
      expect(state.dragStart).toEqual({ x: 150, y: 250 });
    });

    it('supports typical hover workflow', () => {
      const state = createMouseState();
      const verse1: VerseLayout = {
        book: 'Genesis',
        chapter: 1,
        verse: 1,
        x: 0,
        y: 0,
        size: 1,
      };
      const verse2: VerseLayout = {
        book: 'Genesis',
        chapter: 1,
        verse: 2,
        x: 10,
        y: 0,
        size: 1,
      };

      // Hover verse 1
      setHoveredVerse(state, verse1);
      expect(state.hoveredVerse).toBe(verse1);

      // Move to verse 2
      setHoveredVerse(state, verse2);
      expect(state.hoveredVerse).toBe(verse2);

      // Leave canvas
      clearHover(state);
      expect(state.hoveredVerse).toBe(null);
    });

    it('supports drag while hovering', () => {
      const state = createMouseState();
      const verse: VerseLayout = {
        book: 'Genesis',
        chapter: 1,
        verse: 1,
        x: 0,
        y: 0,
        size: 1,
      };

      // Hover a verse
      setHoveredVerse(state, verse);

      // Start dragging (hover persists during drag)
      startDrag(state, 100, 200);
      expect(state.isDragging).toBe(true);
      expect(state.hoveredVerse).toBe(verse);

      // Stop drag (hover still persists)
      stopDrag(state);
      expect(state.isDragging).toBe(false);
      expect(state.hoveredVerse).toBe(verse);
    });
  });
});
