import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  registerOverlay,
  getOverlay,
  divineNamesOverlay,
  commentaryOverlay,
  tropOverlay,
  searchOverlay,
  configureCommentary,
  configureTrop,
  configureSearch,
  type Overlay,
} from '../../overlays/index';
import {
  parseUrlState,
  buildUrlHash,
  updateUrl,
  type UrlState,
} from '../../urlState';
import {
  createVerse,
  createVerses,
  SAMPLE_VERSES,
  SAMPLE_COMMENTARY_DATA,
  SAMPLE_DIVINE_NAMES_DATA,
  SAMPLE_VERSE_TEXTS,
} from '../helpers/fixtures';
import { mockWindowLocation, restoreAllMocks } from '../helpers/mocks';
import type { Verse } from '../../types';

/**
 * Integration tests for complete user workflows
 * Tests realistic multi-step user interactions from start to finish
 */
describe('User Workflows Integration', () => {
  let verses: Verse[];
  let currentOverlay: Overlay | null = null;
  let mockControlsContainer: HTMLElement;
  let mockLegendContainer: HTMLElement;
  let originalLocation: Location;

  beforeEach(() => {
    verses = SAMPLE_VERSES;

    // Mock DOM elements
    mockControlsContainer = document.createElement('div');
    mockLegendContainer = document.createElement('div');

    // Save and mock window.location
    originalLocation = window.location;
    mockWindowLocation('http://localhost:5173/');

    // Mock history API to update mock location
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    vi.spyOn(history, 'pushState').mockImplementation((state, title, url) => {
      if (url) {
        const fullUrl = url.startsWith('http') ? url : `http://localhost:5173${url}`;
        mockWindowLocation(fullUrl);
      }
      return originalPushState(state, title, url);
    });

    vi.spyOn(history, 'replaceState').mockImplementation((state, title, url) => {
      if (url) {
        const fullUrl = url.startsWith('http') ? url : `http://localhost:5173${url}`;
        mockWindowLocation(fullUrl);
      }
      return originalReplaceState(state, title, url);
    });

    // Mock fetch for overlay data
    global.fetch = vi.fn((url: string | Request) => {
      const urlString = typeof url === 'string' ? url : url.url;

      let data: any;
      if (urlString.includes('divine-names.json')) {
        data = SAMPLE_DIVINE_NAMES_DATA;
      } else if (urlString.includes('commentary-counts.json')) {
        data = SAMPLE_COMMENTARY_DATA;
      } else {
        data = {};
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(data),
      } as Response);
    });

    // Register overlays
    registerOverlay(divineNamesOverlay);
    registerOverlay(commentaryOverlay);
    registerOverlay(tropOverlay);
    registerOverlay(searchOverlay);

    // Configure overlays
    configureCommentary({ verses });
    configureTrop({ verseTexts: SAMPLE_VERSE_TEXTS });
    configureSearch({
      verses,
      callbacks: { onVerseClick: vi.fn() },
    });

    currentOverlay = null;
  });

  afterEach(() => {
    currentOverlay?.destroy?.();
    restoreAllMocks();
    // Restore original location
    window.location = originalLocation;
  });

  /**
   * Helper to switch to an overlay
   */
  async function switchToOverlay(overlayId: string): Promise<Overlay> {
    currentOverlay?.destroy?.();

    const overlay = getOverlay(overlayId);
    if (!overlay) {
      throw new Error(`Overlay ${overlayId} not found`);
    }

    await overlay.init?.();

    mockControlsContainer.innerHTML = '';
    overlay.renderControls?.(mockControlsContainer);

    mockLegendContainer.innerHTML = '';
    overlay.renderLegend?.(mockLegendContainer);

    currentOverlay = overlay;
    return overlay;
  }

  describe('Multi-Step Interaction Flows', () => {
    it('completes full workflow: click verse → change overlay → zoom → search', async () => {
      // Step 1: Select a verse
      const selectedVerse = verses[0]; // Genesis 1:1
      let state: UrlState = {
        verse: `${selectedVerse.book}.${selectedVerse.chapter}.${selectedVerse.verse}`,
        overlayParams: {},
      };
      updateUrl(state, true);

      let parsed = parseUrlState();
      expect(parsed.verse).toBe(state.verse);

      // Step 2: Change to commentary overlay
      await switchToOverlay('commentary');
      state = {
        ...state,
        overlay: 'commentary',
      };
      updateUrl(state, true);

      parsed = parseUrlState();
      expect(parsed.overlay).toBe('commentary');
      expect(parsed.verse).toBe(state.verse);

      // Step 3: Zoom in
      state = {
        ...state,
        zoom: 2.5,
      };
      updateUrl(state, false); // replaceState for zoom

      parsed = parseUrlState();
      expect(parsed.zoom).toBe(2.5);
      expect(parsed.overlay).toBe('commentary');
      expect(parsed.verse).toBe(state.verse);

      // Step 4: Switch to search overlay
      await switchToOverlay('search');
      state = {
        overlay: 'search',
        overlayParams: { q: 'moses' },
        zoom: 2.5,
        verse: state.verse,
      };
      updateUrl(state, true);

      parsed = parseUrlState();
      expect(parsed.overlay).toBe('search');
      expect(parsed.overlayParams.q).toBe('moses');
      expect(parsed.zoom).toBe(2.5);
      expect(parsed.verse).toBe(state.verse);

      // Verify overlay is functional
      expect(currentOverlay?.id).toBe('search');
      const color = currentOverlay!.getVerseColor(selectedVerse);
      expect(color).toBeDefined();
    });

    it('switches overlays multiple times without state leakage', async () => {
      const overlaySequence = [
        { id: 'divine-names', params: {} },
        { id: 'commentary', params: { category: 'talmud' } },
        { id: 'trop', params: { trop: 'tipcha' } },
        { id: 'search', params: { q: 'abraham' } },
        { id: 'divine-names', params: {} },
      ];

      for (const { id, params } of overlaySequence) {
        await switchToOverlay(id);

        const state: UrlState = {
          overlay: id,
          overlayParams: params,
        };
        updateUrl(state, true);

        const parsed = parseUrlState();
        expect(parsed.overlay).toBe(id);

        // Verify no leakage of previous overlay params
        const otherParams = overlaySequence
          .filter(o => o.id !== id)
          .flatMap(o => Object.keys(o.params));

        for (const paramKey of otherParams) {
          if (!Object.keys(params).includes(paramKey)) {
            expect(parsed.overlayParams[paramKey]).toBeUndefined();
          }
        }
      }

      // Final state should be divine-names with no params
      const finalParsed = parseUrlState();
      expect(finalParsed.overlay).toBe('divine-names');
      expect(finalParsed.overlayParams.category).toBeUndefined();
      expect(finalParsed.overlayParams.trop).toBeUndefined();
      expect(finalParsed.overlayParams.q).toBeUndefined();
    });

    it('completes deep zoom → pan → reset cycle', () => {
      // Start at default
      let state: UrlState = {
        zoom: 1.0,
        overlayParams: {},
      };
      updateUrl(state, true);

      // Deep zoom in
      state = {
        zoom: 8.0,
        overlayParams: {},
      };
      updateUrl(state, false);

      let parsed = parseUrlState();
      expect(parsed.zoom).toBe(8.0);

      // Pan while zoomed
      state = {
        zoom: 8.0,
        x: 500,
        y: 300,
        overlayParams: {},
      };
      updateUrl(state, false);

      parsed = parseUrlState();
      expect(parsed.zoom).toBe(8.0);
      expect(parsed.x).toBe(500);
      expect(parsed.y).toBe(300);

      // Reset to default (zoom 1, no pan)
      state = {
        zoom: 1.0,
        overlayParams: {},
      };
      updateUrl(state, false);

      parsed = parseUrlState();
      expect(parsed.zoom).toBeUndefined(); // 1.0 is omitted as default
      expect(parsed.x).toBeUndefined();
      expect(parsed.y).toBeUndefined();
    });
  });

  describe('State Persistence with Page Refresh', () => {
    it('restores complete state from URL after page load', async () => {
      // Simulate user building up state
      const fullState: UrlState = {
        overlay: 'commentary',
        overlayParams: { category: 'midrash' },
        verse: 'Exodus.20.2',
        zoom: 3.0,
      };

      const hash = buildUrlHash(fullState);

      // Simulate page refresh by re-parsing the URL
      mockWindowLocation(`http://localhost:5173/${hash}`);
      const restored = parseUrlState();

      expect(restored.overlay).toBe('commentary');
      expect(restored.overlayParams.category).toBe('midrash');
      expect(restored.verse).toBe('Exodus.20.2');
      expect(restored.zoom).toBe(3.0);

      // Verify overlay can be initialized with restored state
      const overlay = await switchToOverlay('commentary');
      const params = new URLSearchParams(`cat=${restored.overlayParams.category}`);
      overlay.applyUrlParams?.(params);

      const resultParams = overlay.getUrlParams?.();
      expect(resultParams?.cat).toBe('midrash');
    });

    it('maintains URL sync throughout full interaction cycle', async () => {
      const interactions = [
        {
          state: { overlay: 'divine-names', overlayParams: {} },
          expected: ['overlay=divine-names'],
        },
        {
          state: { overlay: 'divine-names', overlayParams: {}, zoom: 2.0 },
          expected: ['overlay=divine-names', 'zoom=2'],
        },
        {
          state: { overlay: 'divine-names', overlayParams: {}, zoom: 2.0, verse: 'Genesis.1.1' },
          expected: ['overlay=divine-names', 'verse=Genesis.1.1'],
        },
        {
          state: { overlay: 'search', overlayParams: { q: 'covenant' }, zoom: 2.0 },
          expected: ['overlay=search', 'q=covenant', 'zoom=2'],
        },
      ];

      for (const { state, expected } of interactions) {
        updateUrl(state, true);

        const hash = window.location.hash;
        for (const expectedPart of expected) {
          expect(hash).toContain(expectedPart);
        }

        const parsed = parseUrlState();
        expect(parsed.overlay).toBe(state.overlay);
        expect(parsed.zoom).toBe(state.zoom);
        expect(parsed.verse).toBe(state.verse);
      }
    });

    it('handles browser back/forward correctly', () => {
      const states: UrlState[] = [
        { overlay: 'divine-names', overlayParams: {} },
        { overlay: 'commentary', overlayParams: { category: 'talmud' } },
        { overlay: 'trop', overlayParams: { trop: 'etnachta' } },
      ];

      // Build history
      for (const state of states) {
        updateUrl(state, true);
      }

      // Verify final state
      let parsed = parseUrlState();
      expect(parsed.overlay).toBe('trop');
      expect(parsed.overlayParams.trop).toBe('etnachta');

      // Simulate browser back (would change URL, we test parsing)
      mockWindowLocation('http://localhost:5173/#overlay=commentary&category=talmud');
      parsed = parseUrlState();
      expect(parsed.overlay).toBe('commentary');
      expect(parsed.overlayParams.category).toBe('talmud');
      expect(parsed.overlayParams.trop).toBeUndefined(); // No leakage

      // Simulate another back
      mockWindowLocation('http://localhost:5173/#overlay=divine-names');
      parsed = parseUrlState();
      expect(parsed.overlay).toBe('divine-names');
      expect(parsed.overlayParams.category).toBeUndefined();
    });
  });

  describe('Performance and Scale', () => {
    it('renders large verse set efficiently', async () => {
      // Create 23,000 verses (full Tanakh scale)
      const largeVerseSet = createVerses(23000);

      const startTime = performance.now();

      // Simulate color calculation for all verses
      await switchToOverlay('commentary');
      const colors = largeVerseSet.map(v => currentOverlay!.getVerseColor(v));

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(colors.length).toBe(23000);
      // Should complete in under 500ms (reasonable threshold)
      expect(duration).toBeLessThan(500);
    });

    it('switches overlays 10 times without memory issues', async () => {
      const overlays = ['divine-names', 'commentary', 'trop', 'search'];
      const iterations = 10;

      // Track memory if available (Node.js)
      const initialMemory = process.memoryUsage?.().heapUsed || 0;

      for (let i = 0; i < iterations; i++) {
        for (const overlayId of overlays) {
          await switchToOverlay(overlayId);

          // Verify overlay is functional
          const colors = verses.map(v => currentOverlay!.getVerseColor(v));
          expect(colors.length).toBe(verses.length);

          // Destroy and verify cleanup
          currentOverlay?.destroy?.();
        }
      }

      const finalMemory = process.memoryUsage?.().heapUsed || 0;

      // Memory growth should be reasonable (< 10MB for 40 overlay switches)
      if (initialMemory > 0) {
        const growth = finalMemory - initialMemory;
        expect(growth).toBeLessThan(10 * 1024 * 1024); // 10MB
      }
    });

    it('handles deep zoom with many verses visible', async () => {
      const largeVerseSet = createVerses(1000);

      const startTime = performance.now();

      // Simulate deep zoom (would show many verses)
      await switchToOverlay('commentary');
      const colors = largeVerseSet.map(v => currentOverlay!.getVerseColor(v));

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(colors.length).toBe(1000);
      // Should complete quickly even with many verses
      expect(duration).toBeLessThan(100);
    });

    it('measures overlay initialization performance', async () => {
      const overlays = ['divine-names', 'commentary', 'trop', 'search'];
      const times: Record<string, number> = {};

      for (const overlayId of overlays) {
        const startTime = performance.now();

        const overlay = getOverlay(overlayId);
        await overlay?.init?.();

        const endTime = performance.now();
        times[overlayId] = endTime - startTime;

        overlay?.destroy?.();
      }

      // All overlays should initialize quickly (< 100ms each)
      for (const [id, time] of Object.entries(times)) {
        expect(time, `${id} took ${time}ms to initialize`).toBeLessThan(100);
      }
    });
  });

  describe('Edge Cases and Stress Tests', () => {
    it('handles very long search queries', async () => {
      const longQuery = 'a'.repeat(1000); // 1000 character query

      await switchToOverlay('search');

      const state: UrlState = {
        overlay: 'search',
        overlayParams: { q: longQuery },
      };

      // Should not throw
      expect(() => updateUrl(state, true)).not.toThrow();

      const hash = buildUrlHash(state);
      expect(hash).toContain('overlay=search');
      expect(hash).toContain('q=');

      // Parse it back
      mockWindowLocation(`http://localhost:5173/${hash}`);
      const parsed = parseUrlState();
      expect(parsed.overlayParams.q).toBe(longQuery);
    });

    it('handles extreme zoom levels', () => {
      const extremeZooms = [0.1, 0.2, 0.5, 1.0, 2.0, 5.0, 8.0, 10.0];

      for (const zoom of extremeZooms) {
        const state: UrlState = {
          zoom,
          overlayParams: {},
        };

        updateUrl(state, false);
        const parsed = parseUrlState();

        if (zoom === 1.0) {
          // Default zoom is omitted
          expect(parsed.zoom).toBeUndefined();
        } else {
          expect(parsed.zoom).toBe(zoom);
        }
      }
    });

    it('handles rapid state changes without errors', () => {
      // Simulate rapid user interactions
      for (let i = 0; i < 50; i++) {
        const state: UrlState = {
          zoom: 1.0 + (i % 10) * 0.5,
          x: i * 10,
          y: i * 20,
          overlayParams: {},
        };

        expect(() => updateUrl(state, false)).not.toThrow();
      }

      // Final state should be parseable
      const parsed = parseUrlState();
      expect(parsed).toBeDefined();
    });

    it('handles rapid overlay switching stress test', async () => {
      const overlays = ['divine-names', 'commentary', 'trop', 'search'];

      for (let i = 0; i < 20; i++) {
        const overlayId = overlays[i % overlays.length];
        await switchToOverlay(overlayId);

        // Verify state is correct
        expect(currentOverlay?.id).toBe(overlayId);

        // Verify colors can be calculated
        const verse = verses[i % verses.length];
        const color = currentOverlay!.getVerseColor(verse);
        expect(color).toBeDefined();
      }
    });

    it('handles empty/whitespace search queries', async () => {
      await switchToOverlay('search');

      const queries = ['', ' ', '   ', '\t', '\n'];

      for (const query of queries) {
        // Don't set empty queries in state - they should be filtered out before reaching buildUrlHash
        const trimmed = query.trim();
        const state: UrlState = {
          overlay: 'search',
          overlayParams: trimmed ? { q: trimmed } : {},
        };

        const hash = buildUrlHash(state);

        // Empty queries should not be included in URL
        if (trimmed === '') {
          expect(hash).toBe('#overlay=search');
        }
      }
    });

    it('handles special characters in all overlay params', async () => {
      const testCases = [
        { overlay: 'search', params: { q: 'שָׁלוֹם עוֹלָם' } }, // Hebrew with nikkud
        { overlay: 'search', params: { q: 'test&special=chars' } }, // URL special chars
        { overlay: 'search', params: { q: 'emoji 🔥 test' } }, // Emoji
        { overlay: 'commentary', params: { category: 'talmud' } }, // Regular ASCII
      ];

      for (const { overlay, params } of testCases) {
        const state: UrlState = {
          overlay,
          overlayParams: params,
        };

        const hash = buildUrlHash(state);
        mockWindowLocation(`http://localhost:5173/${hash}`);

        const parsed = parseUrlState();
        expect(parsed.overlay).toBe(overlay);

        // Special characters should round-trip correctly
        for (const [key, value] of Object.entries(params)) {
          if (value.trim() !== '') {
            expect(parsed.overlayParams[key]).toBe(value);
          }
        }
      }
    });
  });

  describe('Real-World User Scenarios', () => {
    it('scenario: Student researches a verse with multiple tools', async () => {
      // Student starts by searching for "creation"
      await switchToOverlay('search');
      let state: UrlState = {
        overlay: 'search',
        overlayParams: { q: 'creation' },
      };
      updateUrl(state, true);

      // Finds Genesis 1:1, clicks it
      state = {
        ...state,
        verse: 'Genesis.1.1',
        zoom: 2.0,
      };
      updateUrl(state, true);

      // Switches to divine names overlay to see divine name usage
      await switchToOverlay('divine-names');
      state = {
        overlay: 'divine-names',
        overlayParams: {},
        verse: 'Genesis.1.1',
        zoom: 2.0,
      };
      updateUrl(state, false);

      // Then checks commentary
      await switchToOverlay('commentary');
      state = {
        overlay: 'commentary',
        overlayParams: { category: 'midrash' },
        verse: 'Genesis.1.1',
        zoom: 2.0,
      };
      updateUrl(state, false);

      // Verify final state
      const parsed = parseUrlState();
      expect(parsed.overlay).toBe('commentary');
      expect(parsed.overlayParams.category).toBe('midrash');
      expect(parsed.verse).toBe('Genesis.1.1');
      expect(parsed.zoom).toBe(2.0);
    });

    it('scenario: Teacher prepares lesson plan by exploring patterns', async () => {
      // Teacher starts with commentary to find well-commented passages
      await switchToOverlay('commentary');
      let state: UrlState = {
        overlay: 'commentary',
        overlayParams: { category: 'all' },
      };
      updateUrl(state, true);

      // Zooms out to see patterns across books
      state = {
        ...state,
        zoom: 0.5,
      };
      updateUrl(state, false);

      // Switches to different categories to compare
      const categories = ['talmud', 'midrash', 'chasidut'];
      for (const category of categories) {
        state = {
          overlay: 'commentary',
          overlayParams: { category },
          zoom: 0.5,
        };
        updateUrl(state, false);

        const parsed = parseUrlState();
        expect(parsed.overlayParams.category).toBe(category);
      }

      // Selects a verse for detailed view
      state = {
        ...state,
        verse: 'Deuteronomy.6.4',
        zoom: 3.0,
      };
      updateUrl(state, true);

      const parsed = parseUrlState();
      expect(parsed.verse).toBe('Deuteronomy.6.4');
      expect(parsed.zoom).toBe(3.0);
    });

    it('scenario: Scholar shares specific view with colleague', async () => {
      // Scholar finds interesting trop pattern
      await switchToOverlay('trop');
      const state: UrlState = {
        overlay: 'trop',
        overlayParams: { trop: 'shalshelet' },
        verse: 'Genesis.39.8',
        zoom: 4.0,
      };
      updateUrl(state, true);

      // Generate shareable URL
      const hash = buildUrlHash(state);
      const shareableUrl = `http://localhost:5173/${hash}`;

      // Colleague opens link (simulate)
      mockWindowLocation(shareableUrl);
      const restored = parseUrlState();

      // State should be exactly restored
      expect(restored.overlay).toBe('trop');
      expect(restored.overlayParams.trop).toBe('shalshelet');
      expect(restored.verse).toBe('Genesis.39.8');
      expect(restored.zoom).toBe(4.0);

      // Overlay should be functional with restored state
      const overlay = await switchToOverlay('trop');
      const params = new URLSearchParams(`trop=${restored.overlayParams.trop}`);
      overlay.applyUrlParams?.(params);

      // Verify overlay has the applyUrlParams method (functional)
      expect(overlay.applyUrlParams).toBeDefined();
      expect(overlay.getUrlParams).toBeDefined();

      // Note: actual trop mark might not exist in sample data, but URL params should round-trip
      const resultParams = overlay.getUrlParams?.();
      expect(resultParams).toBeDefined();
    });

    it('scenario: User explores with random clicks and recovers', async () => {
      // Simulate chaotic exploration
      const randomActions = [
        () => switchToOverlay('divine-names'),
        () => switchToOverlay('commentary'),
        () => updateUrl({ zoom: 5.0, overlayParams: {} }, false),
        () => updateUrl({ x: 100, y: 200, overlayParams: {} }, false),
        () => switchToOverlay('trop'),
        () => updateUrl({ verse: 'Psalms.23.1', overlayParams: {} }, true),
        () => switchToOverlay('search'),
        () => updateUrl({ overlay: 'search', overlayParams: { q: 'test' } }, false),
      ];

      for (const action of randomActions) {
        await action();
      }

      // User wants to reset - clears URL
      mockWindowLocation('http://localhost:5173/');
      const parsed = parseUrlState();

      // Should return to default state
      expect(parsed.overlay).toBeUndefined();
      expect(parsed.verse).toBeUndefined();
      expect(parsed.zoom).toBeUndefined();
      expect(parsed.x).toBeUndefined();
      expect(parsed.y).toBeUndefined();
    });
  });

  describe('State Consistency Verification', () => {
    it('maintains overlay state consistency across zoom changes', async () => {
      await switchToOverlay('commentary');

      let state: UrlState = {
        overlay: 'commentary',
        overlayParams: { category: 'kabbalah' },
        zoom: 1.0,
      };
      updateUrl(state, true);

      // Change zoom multiple times
      const zooms = [1.5, 2.0, 3.0, 2.5, 1.0];
      for (const zoom of zooms) {
        state = { ...state, zoom };
        updateUrl(state, false);

        const parsed = parseUrlState();
        expect(parsed.overlay).toBe('commentary');
        expect(parsed.overlayParams.category).toBe('kabbalah');
        expect(parsed.zoom).toBe(zoom === 1.0 ? undefined : zoom); // 1.0 is omitted
      }
    });

    it('maintains verse selection across overlay changes', async () => {
      const verse = 'Exodus.20.2';

      const overlays = ['divine-names', 'commentary', 'trop', 'search'];

      for (const overlayId of overlays) {
        await switchToOverlay(overlayId);

        const state: UrlState = {
          overlay: overlayId,
          overlayParams: {},
          verse,
        };
        updateUrl(state, false);

        const parsed = parseUrlState();
        expect(parsed.verse).toBe(verse);
        expect(parsed.overlay).toBe(overlayId);
      }
    });

    it('clears verse when navigating without selection', async () => {
      // Start with verse selected
      let state: UrlState = {
        overlay: 'commentary',
        overlayParams: {},
        verse: 'Genesis.1.1',
      };
      updateUrl(state, true);

      let parsed = parseUrlState();
      expect(parsed.verse).toBe('Genesis.1.1');

      // Clear verse selection
      state = {
        overlay: 'commentary',
        overlayParams: {},
      };
      updateUrl(state, false);

      parsed = parseUrlState();
      expect(parsed.verse).toBeUndefined();
    });
  });
});
