import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseUrlState,
  buildUrlHash,
  updateUrl,
  subscribeToHashChange,
  verseToUrlFormat,
  parseVerseFromUrl,
  type UrlState,
} from '../../urlState';
import {
  registerOverlay,
  getOverlay,
  commentaryOverlay,
  tropOverlay,
  searchOverlay,
  configureCommentary,
  configureTrop,
  configureSearch,
} from '../../overlays/index';
import {
  SAMPLE_VERSES,
  SAMPLE_COMMENTARY_DATA,
  SAMPLE_VERSE_TEXTS,
} from '../helpers/fixtures';
import { mockWindowLocation, restoreAllMocks } from '../helpers/mocks';
import { overlayUrlParams } from '../helpers/allOverlays';
import { applyOverlayParams } from '../helpers/overlayUrlParams';

/**
 * Integration test for URL state synchronization with overlay system
 * Tests how URL state persists overlay selection, filters, search terms, and view state
 */
describe('URL State Sync Integration', () => {
  let originalLocation: Location;
  let historyStates: string[] = [];

  beforeEach(() => {
    // Save original location
    originalLocation = window.location;

    // Mock window.location
    mockWindowLocation('http://localhost:5173/');

    // Mock history API
    historyStates = [];
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    vi.spyOn(history, 'pushState').mockImplementation((state, title, url) => {
      historyStates.push(url as string);
      // Update mock location
      if (url) {
        const urlString = typeof url === 'string' ? url : url.toString();
        const fullUrl = urlString.startsWith('http') ? urlString : `http://localhost:5173${urlString}`;
        mockWindowLocation(fullUrl);
      }
      return originalPushState(state, title, url);
    });

    vi.spyOn(history, 'replaceState').mockImplementation((state, title, url) => {
      if (historyStates.length > 0) {
        historyStates[historyStates.length - 1] = url as string;
      } else {
        historyStates.push(url as string);
      }
      // Update mock location
      if (url) {
        const urlString = typeof url === 'string' ? url : url.toString();
        const fullUrl = urlString.startsWith('http') ? urlString : `http://localhost:5173${urlString}`;
        mockWindowLocation(fullUrl);
      }
      return originalReplaceState(state, title, url);
    });

    // Mock fetch for overlay data
    globalThis.fetch = vi.fn((url: string | Request) => {
      const urlString = typeof url === 'string' ? url : url.url;

      let data: any;
      if (urlString.includes('commentary-counts.json')) {
        data = SAMPLE_COMMENTARY_DATA;
      } else {
        data = {};
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(data),
      } as Response);
    }) as any;

    // Register overlays
    registerOverlay(commentaryOverlay);
    registerOverlay(tropOverlay);
    registerOverlay(searchOverlay);

    // Configure overlays with sample data
    configureCommentary({ verses: SAMPLE_VERSES });
    configureTrop({ verseTexts: SAMPLE_VERSE_TEXTS });
    configureSearch({
      verses: SAMPLE_VERSES,
      callbacks: { onVerseClick: vi.fn() },
    });
  });

  afterEach(() => {
    restoreAllMocks();
    // Restore original location
    (window as any).location = originalLocation;
  });

  describe('URL State Parsing', () => {
    it('parses overlay from URL hash', () => {
      mockWindowLocation('http://localhost:5173/#overlay=commentary');
      const state = parseUrlState(overlayUrlParams);

      expect(state.overlay).toBe('commentary');
    });

    it('parses overlay-specific parameters for commentary', () => {
      mockWindowLocation('http://localhost:5173/#overlay=commentary&category=talmud');
      const state = parseUrlState(overlayUrlParams);

      expect(state.overlay).toBe('commentary');
      expect(state.overlayParams.category).toBe('talmud');
    });

    it('parses overlay-specific parameters for trop', () => {
      mockWindowLocation('http://localhost:5173/#overlay=trop&trop=tipcha');
      const state = parseUrlState(overlayUrlParams);

      expect(state.overlay).toBe('trop');
      expect(state.overlayParams.trop).toBe('tipcha');
    });

    it('parses overlay-specific parameters for search', () => {
      mockWindowLocation('http://localhost:5173/#overlay=search&q=moses');
      const state = parseUrlState(overlayUrlParams);

      expect(state.overlay).toBe('search');
      expect(state.overlayParams.q).toBe('moses');
    });

    it('parses search query with special characters', () => {
      mockWindowLocation('http://localhost:5173/#overlay=search&q=%D7%91%D7%A8%D7%90%D7%A9%D7%99%D7%AA');
      const state = parseUrlState(overlayUrlParams);

      expect(state.overlay).toBe('search');
      expect(state.overlayParams.q).toBe('בראשית');
    });

    it('parses verse selection', () => {
      mockWindowLocation('http://localhost:5173/#verse=Genesis.1.1');
      const state = parseUrlState(overlayUrlParams);

      expect(state.verse).toBe('Genesis.1.1');
    });

    it('parses verse with multi-word book name', () => {
      mockWindowLocation('http://localhost:5173/#verse=I.Samuel.1.5');
      const state = parseUrlState(overlayUrlParams);

      expect(state.verse).toBe('I.Samuel.1.5');
    });

    it('parses zoom level', () => {
      mockWindowLocation('http://localhost:5173/#zoom=2.5');
      const state = parseUrlState(overlayUrlParams);

      expect(state.zoom).toBe(2.5);
    });

    it('parses pan coordinates', () => {
      mockWindowLocation('http://localhost:5173/#x=100&y=200');
      const state = parseUrlState(overlayUrlParams);

      expect(state.x).toBe(100);
      expect(state.y).toBe(200);
    });

    it('parses complete state with all parameters', () => {
      mockWindowLocation('http://localhost:5173/#overlay=commentary&category=midrash&verse=Genesis.1.1&zoom=1.5&x=50&y=75');
      const state = parseUrlState(overlayUrlParams);

      expect(state.overlay).toBe('commentary');
      expect(state.overlayParams.category).toBe('midrash');
      expect(state.verse).toBe('Genesis.1.1');
      expect(state.zoom).toBe(1.5);
      expect(state.x).toBe(50);
      expect(state.y).toBe(75);
    });

    it('handles empty hash', () => {
      mockWindowLocation('http://localhost:5173/');
      const state = parseUrlState(overlayUrlParams);

      expect(state.overlay).toBeUndefined();
      expect(state.verse).toBeUndefined();
      expect(state.zoom).toBeUndefined();
    });

    it('handles malformed zoom values', () => {
      mockWindowLocation('http://localhost:5173/#zoom=invalid');
      const state = parseUrlState(overlayUrlParams);

      expect(state.zoom).toBeUndefined();
    });

    it('clamps zoom to valid range', () => {
      mockWindowLocation('http://localhost:5173/#zoom=20');
      const state = parseUrlState(overlayUrlParams);

      // Should be clamped to max of 10
      expect(state.zoom).toBeUndefined(); // Out of range, so ignored

      mockWindowLocation('http://localhost:5173/#zoom=0.05');
      const state2 = parseUrlState(overlayUrlParams);

      expect(state2.zoom).toBeUndefined(); // Out of range, so ignored
    });
  });

  describe('URL State Building', () => {
    it('builds hash with overlay selection', () => {
      const state: UrlState = {
        overlay: 'commentary',
        overlayParams: {},
      };

      const hash = buildUrlHash(state);
      expect(hash).toBe('#overlay=commentary');
    });

    it('builds hash with commentary overlay and category', () => {
      const state: UrlState = {
        overlay: 'commentary',
        overlayParams: { category: 'talmud' },
      };

      const hash = buildUrlHash(state);
      expect(hash).toContain('overlay=commentary');
      expect(hash).toContain('category=talmud');
    });

    it('builds hash with trop overlay and selected mark', () => {
      const state: UrlState = {
        overlay: 'trop',
        overlayParams: { trop: 'tipcha' },
      };

      const hash = buildUrlHash(state);
      expect(hash).toContain('overlay=trop');
      expect(hash).toContain('trop=tipcha');
    });

    it('builds hash with search overlay and query', () => {
      const state: UrlState = {
        overlay: 'search',
        overlayParams: { q: 'moses' },
      };

      const hash = buildUrlHash(state);
      expect(hash).toContain('overlay=search');
      expect(hash).toContain('q=moses');
    });

    it('builds hash with verse selection', () => {
      const state: UrlState = {
        verse: 'Genesis.1.1',
        overlayParams: {},
      };

      const hash = buildUrlHash(state);
      expect(hash).toBe('#verse=Genesis.1.1');
    });

    it('builds hash with zoom', () => {
      const state: UrlState = {
        zoom: 2.5,
        overlayParams: {},
      };

      const hash = buildUrlHash(state);
      expect(hash).toBe('#zoom=2.5');
    });

    it('omits default zoom value (1.0)', () => {
      const state: UrlState = {
        zoom: 1.0,
        overlayParams: {},
      };

      const hash = buildUrlHash(state);
      expect(hash).toBe('');
    });

    it('builds hash with pan coordinates', () => {
      const state: UrlState = {
        x: 100,
        y: 200,
        overlayParams: {},
      };

      const hash = buildUrlHash(state);
      expect(hash).toContain('x=100');
      expect(hash).toContain('y=200');
    });

    it('omits pan coordinates when verse is selected', () => {
      const state: UrlState = {
        verse: 'Genesis.1.1',
        x: 100,
        y: 200,
        overlayParams: {},
      };

      const hash = buildUrlHash(state);
      expect(hash).toBe('#verse=Genesis.1.1');
      expect(hash).not.toContain('x=');
      expect(hash).not.toContain('y=');
    });

    it('omits the category when the overlay is on its default', () => {
      // The overlay, not the URL layer, decides that "total" means "nothing
      // to say", so it reports no parameters at all.
      const state: UrlState = {
        overlay: 'commentary',
        overlayParams: commentaryOverlay.getUrlParams?.() ?? {},
      };

      const hash = buildUrlHash(state);
      expect(hash).toBe('#overlay=commentary');
      expect(hash).not.toContain('category=');
    });

    it('rounds zoom to reasonable precision', () => {
      const state: UrlState = {
        zoom: 2.123456789,
        overlayParams: {},
      };

      const hash = buildUrlHash(state);
      expect(hash).toBe('#zoom=2.12');
    });

    it('rounds pan coordinates', () => {
      const state: UrlState = {
        x: 100.123456,
        y: 200.987654,
        overlayParams: {},
      };

      const hash = buildUrlHash(state);
      expect(hash).toContain('x=100.1');
      expect(hash).toContain('y=201');
    });

    it('returns empty string for default state', () => {
      const state: UrlState = {
        overlayParams: {},
      };

      const hash = buildUrlHash(state);
      expect(hash).toBe('');
    });
  });

  describe('URL Update Operations', () => {
    it('updates URL with replaceState by default', () => {
      const state: UrlState = {
        overlay: 'commentary',
        overlayParams: {},
      };

      updateUrl(state, false);

      expect(history.replaceState).toHaveBeenCalled();
      expect(history.pushState).not.toHaveBeenCalled();
      expect(window.location.hash).toBe('#overlay=commentary');
    });

    it('updates URL with pushState when requested', () => {
      const state: UrlState = {
        overlay: 'commentary',
        overlayParams: {},
      };

      updateUrl(state, true);

      expect(history.pushState).toHaveBeenCalled();
      expect(historyStates.length).toBe(1);
    });

    it('preserves pathname and search when updating hash', () => {
      mockWindowLocation('http://localhost:5173/app?debug=true');

      const state: UrlState = {
        overlay: 'commentary',
        overlayParams: {},
      };

      updateUrl(state, false);

      const lastUrl = historyStates[historyStates.length - 1];
      expect(lastUrl).toContain('/app');
      expect(lastUrl).toContain('?debug=true');
      expect(lastUrl).toContain('#overlay=commentary');
    });
  });

  describe('Overlay Integration', () => {
    it('integrates with commentary overlay URL params', async () => {
      const overlay = getOverlay('commentary');
      await overlay?.init?.();

      // Apply URL params
      const params = new URLSearchParams('category=talmud');
      applyOverlayParams(overlay, params);

      // Get URL params back
      const urlParams = overlay?.getUrlParams?.();
      expect(urlParams).toEqual({ category: 'talmud' });
    });

    it('integrates with trop overlay URL params', async () => {
      const overlay = getOverlay('trop');
      await overlay?.init?.();

      // Apply URL params
      const params = new URLSearchParams('trop=tipcha');
      applyOverlayParams(overlay, params);

      // Get URL params back
      const urlParams = overlay?.getUrlParams?.();
      expect(urlParams).toEqual({ trop: 'tipcha' });
    });

    it('integrates with search overlay URL params', async () => {
      const overlay = getOverlay('search');
      await overlay?.init?.();

      // Apply URL params
      const params = new URLSearchParams('q=moses');
      applyOverlayParams(overlay, params);

      // Get URL params back
      const urlParams = overlay?.getUrlParams?.();
      expect(urlParams).toEqual({ q: 'moses' });
    });


    it('handles overlay switch in URL', async () => {
      // Start with commentary
      mockWindowLocation('http://localhost:5173/#overlay=commentary&category=midrash');
      let state = parseUrlState(overlayUrlParams);

      expect(state.overlay).toBe('commentary');
      expect(state.overlayParams.category).toBe('midrash');

      // Switch to trop
      mockWindowLocation('http://localhost:5173/#overlay=trop&trop=etnachta');
      state = parseUrlState(overlayUrlParams);

      expect(state.overlay).toBe('trop');
      expect(state.overlayParams.trop).toBe('etnachta');
      expect(state.overlayParams.category).toBeUndefined();
    });

    it('clears overlay-specific params when switching overlays', () => {
      // Commentary with category
      const state1: UrlState = {
        overlay: 'commentary',
        overlayParams: { category: 'talmud' },
      };
      const hash1 = buildUrlHash(state1);

      // Switch to trop (no category param)
      const state2: UrlState = {
        overlay: 'trop',
        overlayParams: { trop: 'tipcha' },
      };
      const hash2 = buildUrlHash(state2);

      expect(hash1).toContain('category=talmud');
      expect(hash2).not.toContain('category');
      expect(hash2).toContain('trop=tipcha');
    });
  });

  describe('Verse Selection URL Integration', () => {
    it('converts verse to URL format', () => {
      const urlFormat = verseToUrlFormat('Genesis', 1, 1);
      expect(urlFormat).toBe('Genesis.1.1');
    });

    it('converts verse with multi-word book name', () => {
      const urlFormat = verseToUrlFormat('I Samuel', 1, 5);
      expect(urlFormat).toBe('I.Samuel.1.5');
    });

    it('parses verse from URL format', () => {
      const verse = parseVerseFromUrl('Genesis.1.1');
      expect(verse).toEqual({ book: 'Genesis', chapter: 1, verse: 1 });
    });

    it('parses verse with multi-word book name', () => {
      const verse = parseVerseFromUrl('I.Samuel.1.5');
      expect(verse).toEqual({ book: 'I Samuel', chapter: 1, verse: 5 });
    });

    it('parses verse with book name containing dots', () => {
      const verse = parseVerseFromUrl('I.Samuel.1.5');
      expect(verse).toEqual({ book: 'I Samuel', chapter: 1, verse: 5 });
    });

    it('handles invalid verse format', () => {
      const verse = parseVerseFromUrl('invalid');
      expect(verse).toBeNull();
    });

    it('handles verse with non-numeric chapter/verse', () => {
      const verse = parseVerseFromUrl('Genesis.abc.def');
      expect(verse).toBeNull();
    });

    it('round-trips verse conversion', () => {
      const original = { book: 'II Kings', chapter: 5, verse: 10 };
      const urlFormat = verseToUrlFormat(original.book, original.chapter, original.verse);
      const parsed = parseVerseFromUrl(urlFormat);

      expect(parsed).toEqual(original);
    });
  });

  describe('Browser History Integration', () => {
    it('creates history entry with pushState', () => {
      const state1: UrlState = {
        overlay: 'commentary',
        overlayParams: {},
      };
      updateUrl(state1, true);

      const state2: UrlState = {
        overlay: 'trop',
        overlayParams: {},
      };
      updateUrl(state2, true);

      expect(historyStates.length).toBe(2);
      expect(historyStates[0]).toContain('commentary');
      expect(historyStates[1]).toContain('trop');
    });

    it('replaces history entry with replaceState', () => {
      const state1: UrlState = {
        zoom: 1.5,
        overlayParams: {},
      };
      updateUrl(state1, false);

      const state2: UrlState = {
        zoom: 2.0,
        overlayParams: {},
      };
      updateUrl(state2, false);

      expect(historyStates.length).toBe(1);
      expect(historyStates[0]).toContain('zoom=2');
    });

    it('subscribes to hash changes', () => {
      const callback = vi.fn();
      subscribeToHashChange(callback);

      // Simulate hashchange event
      const event = new Event('hashchange');
      window.dispatchEvent(event);

      expect(callback).toHaveBeenCalled();
    });

    it('subscribes to popstate events', () => {
      const callback = vi.fn();
      subscribeToHashChange(callback);

      // Simulate popstate event (browser back/forward)
      const event = new Event('popstate');
      window.dispatchEvent(event);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles missing overlay parameter gracefully', () => {
      mockWindowLocation('http://localhost:5173/#category=talmud');
      const state = parseUrlState(overlayUrlParams);

      // With no overlay named, there is nobody the setting could belong to,
      // so it is dropped rather than carried around unused.
      expect(state.overlay).toBeUndefined();
      expect(state.overlayParams).toEqual({});
    });

    it('handles malformed URL hash', () => {
      mockWindowLocation('http://localhost:5173/#invalid&&&format');

      expect(() => parseUrlState(overlayUrlParams)).not.toThrow();
      const state = parseUrlState(overlayUrlParams);
      expect(state).toBeDefined();
    });

    it('handles empty parameter values', () => {
      mockWindowLocation('http://localhost:5173/#overlay=&category=');
      const state = parseUrlState(overlayUrlParams);

      // Empty string values are treated as falsy and ignored for all params
      expect(state.overlay).toBeUndefined();
      expect(state.overlayParams.category).toBeUndefined();
    });

    it('handles special characters in search query', () => {
      const state: UrlState = {
        overlay: 'search',
        overlayParams: { q: 'שלום עולם' },
      };

      const hash = buildUrlHash(state);
      expect(hash).toContain('overlay=search');
      expect(hash).toContain('q=');

      // Parse it back
      mockWindowLocation(`http://localhost:5173/${hash}`);
      const parsed = parseUrlState(overlayUrlParams);
      expect(parsed.overlayParams.q).toBe('שלום עולם');
    });

    it('handles URL with many parameters', () => {
      const state: UrlState = {
        overlay: 'commentary',
        overlayParams: { category: 'talmud' },
        verse: 'Genesis.1.1',
        zoom: 2.5,
        x: 100,
        y: 200,
      };

      const hash = buildUrlHash(state);

      mockWindowLocation(`http://localhost:5173/${hash}`);
      const parsed = parseUrlState(overlayUrlParams);

      expect(parsed.overlay).toBe('commentary');
      expect(parsed.overlayParams.category).toBe('talmud');
      expect(parsed.verse).toBe('Genesis.1.1');
      expect(parsed.zoom).toBe(2.5);

      // x and y should be omitted from hash when verse is present (buildUrlHash behavior)
      expect(hash).not.toMatch(/[?&]x=/);
      expect(hash).not.toMatch(/[?&#]y=/);

      // But parsed state should not have x/y since they weren't in the hash
      expect(parsed.x).toBeUndefined();
      expect(parsed.y).toBeUndefined();
    });

    it('handles overlay with invalid/unknown ID', () => {
      mockWindowLocation('http://localhost:5173/#overlay=nonexistent');
      const state = parseUrlState(overlayUrlParams);

      expect(state.overlay).toBe('nonexistent');
      // Getting the overlay should return undefined
      const overlay = getOverlay('nonexistent');
      expect(overlay).toBeUndefined();
    });

    it('handles numeric values at boundary conditions', () => {
      mockWindowLocation('http://localhost:5173/#zoom=0.1&x=0&y=0');
      const state = parseUrlState(overlayUrlParams);

      expect(state.zoom).toBe(0.1);
      expect(state.x).toBe(0);
      expect(state.y).toBe(0);
    });

    it('handles negative coordinates', () => {
      const state: UrlState = {
        x: -100,
        y: -200,
        overlayParams: {},
      };

      const hash = buildUrlHash(state);
      expect(hash).toContain('x=-100');
      expect(hash).toContain('y=-200');
    });
  });

  describe('Complete State Synchronization', () => {
    it('maintains state across parse and build cycle', () => {
      const originalState: UrlState = {
        overlay: 'commentary',
        overlayParams: { category: 'midrash' },
        verse: 'Exodus.20.1',
        zoom: 1.75,
      };

      const hash = buildUrlHash(originalState);
      mockWindowLocation(`http://localhost:5173/${hash}`);
      const parsedState = parseUrlState(overlayUrlParams);

      expect(parsedState.overlay).toBe(originalState.overlay);
      expect(parsedState.overlayParams.category).toBe(originalState.overlayParams.category);
      expect(parsedState.verse).toBe(originalState.verse);
      expect(parsedState.zoom).toBe(originalState.zoom);
    });

    it('synchronizes overlay state changes to URL', async () => {
      // Start with commentary overlay
      const overlay = getOverlay('commentary');
      await overlay?.init?.();

      // Apply initial state
      const params1 = new URLSearchParams('category=talmud');
      applyOverlayParams(overlay, params1);

      // Get URL params
      const urlParams1 = overlay?.getUrlParams?.();
      expect(urlParams1).toEqual({ category: 'talmud' });

      // Build URL state
      const state1: UrlState = {
        overlay: 'commentary',
        overlayParams: urlParams1 ?? {},
      };
      const hash1 = buildUrlHash(state1);

      // Parse it back
      mockWindowLocation(`http://localhost:5173/${hash1}`);
      const parsed1 = parseUrlState(overlayUrlParams);

      expect(parsed1.overlay).toBe('commentary');
      expect(parsed1.overlayParams.category).toBe('talmud');
    });

    it('synchronizes view state (pan/zoom) with URL', () => {
      const state: UrlState = {
        zoom: 2.0,
        x: 150,
        y: 250,
        overlayParams: {},
      };

      updateUrl(state, false);

      const parsed = parseUrlState(overlayUrlParams);
      expect(parsed.zoom).toBe(2.0);
      expect(parsed.x).toBe(150);
      expect(parsed.y).toBe(250);
    });

    it('transitions between different overlay states', async () => {
      // Start with commentary
      const state1: UrlState = {
        overlay: 'commentary',
        overlayParams: { category: 'talmud' },
        zoom: 1.5,
      };
      updateUrl(state1, true);

      let parsed = parseUrlState(overlayUrlParams);
      expect(parsed.overlay).toBe('commentary');
      expect(parsed.overlayParams.category).toBe('talmud');

      // Switch to trop
      const state2: UrlState = {
        overlay: 'trop',
        overlayParams: { trop: 'etnachta' },
        zoom: 1.5,
      };
      updateUrl(state2, true);

      parsed = parseUrlState(overlayUrlParams);
      expect(parsed.overlay).toBe('trop');
      expect(parsed.overlayParams.trop).toBe('etnachta');
      expect(parsed.overlayParams.category).toBeUndefined();

      // Switch to search
      const state3: UrlState = {
        overlay: 'search',
        overlayParams: { q: 'abraham' },
        zoom: 1.5,
      };
      updateUrl(state3, true);

      parsed = parseUrlState(overlayUrlParams);
      expect(parsed.overlay).toBe('search');
      expect(parsed.overlayParams.q).toBe('abraham');
      expect(parsed.overlayParams.trop).toBeUndefined();

      // History should have 3 entries
      expect(historyStates.length).toBe(3);
    });

    it('preserves overlay state when changing view state', () => {
      // Set overlay state
      const state1: UrlState = {
        overlay: 'commentary',
        overlayParams: { category: 'midrash' },
        zoom: 1.0,
      };
      updateUrl(state1, true);

      // Update only zoom (replaceState)
      const state2: UrlState = {
        overlay: 'commentary',
        overlayParams: { category: 'midrash' },
        zoom: 2.0,
      };
      updateUrl(state2, false);

      // Parse final state
      const parsed = parseUrlState(overlayUrlParams);
      expect(parsed.overlay).toBe('commentary');
      expect(parsed.overlayParams.category).toBe('midrash');
      expect(parsed.zoom).toBe(2.0);

      // Should only have 1 history entry (pushState then replaceState)
      expect(historyStates.length).toBe(1);
    });
  });

  describe('Real-World Scenarios', () => {
    it('handles shareable link workflow', () => {
      // User selects overlay and filters
      const state: UrlState = {
        overlay: 'commentary',
        overlayParams: { category: 'chasidut' },
        verse: 'Deuteronomy.6.4',
        zoom: 2.5,
      };

      // Generate shareable URL
      const hash = buildUrlHash(state);
      const url = `http://localhost:5173/${hash}`;

      // Simulate user opening shared link
      mockWindowLocation(url);
      const restored = parseUrlState(overlayUrlParams);

      expect(restored.overlay).toBe('commentary');
      expect(restored.overlayParams.category).toBe('chasidut');
      expect(restored.verse).toBe('Deuteronomy.6.4');
      expect(restored.zoom).toBe(2.5);
    });

    it('handles search-then-select workflow', async () => {
      // User searches
      const searchState: UrlState = {
        overlay: 'search',
        overlayParams: { q: 'covenant' },
      };
      updateUrl(searchState, true);

      // User selects a verse from results
      const selectedState: UrlState = {
        overlay: 'search',
        overlayParams: { q: 'covenant' },
        verse: 'Genesis.17.2',
        zoom: 2.0,
      };
      updateUrl(selectedState, true);

      // Verify both states in history
      expect(historyStates.length).toBe(2);
      expect(historyStates[0]).toContain('q=covenant');
      expect(historyStates[1]).toContain('verse=Genesis.17.2');
    });

    it('handles overlay exploration workflow', async () => {
      // User tries different overlays
      const overlays = ['commentary', 'trop', 'search'];

      for (const overlayId of overlays) {
        const state: UrlState = {
          overlay: overlayId,
          overlayParams: {},
        };
        updateUrl(state, true);
      }

      // All transitions should be in history
      expect(historyStates.length).toBe(3);
      expect(historyStates[0]).toContain('commentary');
      expect(historyStates[1]).toContain('trop');
      expect(historyStates[2]).toContain('search');
    });

    it('handles pan/zoom refinement without history spam', () => {
      // Initial view
      const state1: UrlState = {
        zoom: 1.0,
        overlayParams: {},
      };
      updateUrl(state1, true);

      // Multiple pan/zoom adjustments (all replaceState)
      for (let i = 0; i < 5; i++) {
        const state: UrlState = {
          zoom: 1.0 + i * 0.2,
          x: i * 10,
          y: i * 20,
          overlayParams: {},
        };
        updateUrl(state, false);
      }

      // Should only have 1 history entry
      expect(historyStates.length).toBe(1);
    });
  });
});
