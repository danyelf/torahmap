import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';
import {
  parseUrlState,
  buildUrlHash,
  updateUrl,
  verseToUrlFormat,
  parseVerseFromUrl,
  subscribeToHashChange,
  type UrlState,
} from '../../urlState';
import { mockWindowLocation } from '../helpers/mocks';
import { overlayUrlParams, ALL_OVERLAYS } from '../helpers/allOverlays';

// Set up window object for tests
beforeAll(() => {
  if (typeof window === 'undefined') {
    (globalThis as any).window = {};
  }
});

describe('parseUrlState', () => {
  beforeEach(() => {
    // Mock history API
    globalThis.history = {
      pushState: vi.fn(),
      replaceState: vi.fn(),
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses empty hash to minimal state', () => {
    mockWindowLocation('http://localhost:5173/');
    const state = parseUrlState(overlayUrlParams);
    expect(state).toEqual({
      overlayParams: {},
    });
  });

  it('parses overlay parameter', () => {
    mockWindowLocation('http://localhost:5173/#overlay=commentary');
    const state = parseUrlState(overlayUrlParams);
    expect(state.overlay).toBe('commentary');
  });

  it('parses verse parameter', () => {
    mockWindowLocation('http://localhost:5173/#verse=Genesis.1.1');
    const state = parseUrlState(overlayUrlParams);
    expect(state.verse).toBe('Genesis.1.1');
  });

  it('parses zoom parameter within valid range', () => {
    mockWindowLocation('http://localhost:5173/#zoom=2.5');
    const state = parseUrlState(overlayUrlParams);
    expect(state.zoom).toBe(2.5);
  });

  it('rejects zoom below minimum (0.1)', () => {
    mockWindowLocation('http://localhost:5173/#zoom=0.05');
    const state = parseUrlState(overlayUrlParams);
    expect(state.zoom).toBeUndefined();
  });

  it('rejects zoom above maximum (10)', () => {
    mockWindowLocation('http://localhost:5173/#zoom=15');
    const state = parseUrlState(overlayUrlParams);
    expect(state.zoom).toBeUndefined();
  });

  it('accepts zoom at boundary (0.1)', () => {
    mockWindowLocation('http://localhost:5173/#zoom=0.1');
    const state = parseUrlState(overlayUrlParams);
    expect(state.zoom).toBe(0.1);
  });

  it('accepts zoom at boundary (10)', () => {
    mockWindowLocation('http://localhost:5173/#zoom=10');
    const state = parseUrlState(overlayUrlParams);
    expect(state.zoom).toBe(10);
  });

  it('rejects non-numeric zoom', () => {
    mockWindowLocation('http://localhost:5173/#zoom=abc');
    const state = parseUrlState(overlayUrlParams);
    expect(state.zoom).toBeUndefined();
  });

  it('parses x and y pan positions', () => {
    mockWindowLocation('http://localhost:5173/#x=100.5&y=-50.25');
    const state = parseUrlState(overlayUrlParams);
    expect(state.x).toBe(100.5);
    expect(state.y).toBe(-50.25);
  });

  it('rejects non-numeric x and y', () => {
    mockWindowLocation('http://localhost:5173/#x=abc&y=def');
    const state = parseUrlState(overlayUrlParams);
    expect(state.x).toBeUndefined();
    expect(state.y).toBeUndefined();
  });

  it('parses trop overlay parameter', () => {
    mockWindowLocation('http://localhost:5173/#overlay=trop&trop=etnachta');
    const state = parseUrlState(overlayUrlParams);
    expect(state.overlay).toBe('trop');
    expect(state.overlayParams.trop).toBe('etnachta');
  });

  it('parses category overlay parameter', () => {
    mockWindowLocation('http://localhost:5173/#overlay=commentary&category=Midrash');
    const state = parseUrlState(overlayUrlParams);
    expect(state.overlay).toBe('commentary');
    expect(state.overlayParams.category).toBe('Midrash');
  });

  it('parses search query parameter', () => {
    mockWindowLocation('http://localhost:5173/#overlay=search&q=בראשית');
    const state = parseUrlState(overlayUrlParams);
    expect(state.overlay).toBe('search');
    expect(state.overlayParams.q).toBe('בראשית');
  });

  it('parses search query with special characters', () => {
    mockWindowLocation('http://localhost:5173/#overlay=search&q=%D7%91%D7%A8%D7%90%D7%A9%D7%99%D7%AA');
    const state = parseUrlState(overlayUrlParams);
    expect(state.overlayParams.q).toBe('בראשית');
  });

  it('parses search query with spaces', () => {
    mockWindowLocation('http://localhost:5173/#overlay=search&q=In%20the%20beginning');
    const state = parseUrlState(overlayUrlParams);
    expect(state.overlayParams.q).toBe('In the beginning');
  });

  it('parses complete state with all parameters', () => {
    mockWindowLocation('http://localhost:5173/#overlay=commentary&verse=Exodus.20.1&zoom=3&category=Talmud');
    const state = parseUrlState(overlayUrlParams);
    expect(state).toEqual({
      overlay: 'commentary',
      verse: 'Exodus.20.1',
      zoom: 3,
      overlayParams: {
        category: 'Talmud',
      },
    });
  });

  it('handles malformed hash with missing values', () => {
    mockWindowLocation('http://localhost:5173/#overlay=&verse=&zoom=');
    const state = parseUrlState(overlayUrlParams);
    // Empty strings should be ignored
    expect(state.overlay).toBeUndefined();
    expect(state.verse).toBeUndefined();
    expect(state.zoom).toBeUndefined();
  });

  it('ignores unknown parameters', () => {
    mockWindowLocation('http://localhost:5173/#overlay=trop&unknown=value&another=param');
    const state = parseUrlState(overlayUrlParams);
    expect(state.overlay).toBe('trop');
    expect((state as any).unknown).toBeUndefined();
  });

  it('handles negative zoom (invalid)', () => {
    mockWindowLocation('http://localhost:5173/#zoom=-1');
    const state = parseUrlState(overlayUrlParams);
    expect(state.zoom).toBeUndefined();
  });

  it('handles zero zoom (invalid)', () => {
    mockWindowLocation('http://localhost:5173/#zoom=0');
    const state = parseUrlState(overlayUrlParams);
    expect(state.zoom).toBeUndefined();
  });

  it('handles negative pan positions', () => {
    mockWindowLocation('http://localhost:5173/#x=-100&y=-200');
    const state = parseUrlState(overlayUrlParams);
    expect(state.x).toBe(-100);
    expect(state.y).toBe(-200);
  });

  it('handles verse with dots in book name', () => {
    mockWindowLocation('http://localhost:5173/#verse=I.Samuel.1.1');
    const state = parseUrlState(overlayUrlParams);
    expect(state.verse).toBe('I.Samuel.1.1');
  });
});

describe('buildUrlHash', () => {
  it('builds empty hash for minimal state', () => {
    const state: UrlState = {
      overlayParams: {},
    };
    const hash = buildUrlHash(state);
    expect(hash).toBe('');
  });

  it('builds hash with overlay', () => {
    const state: UrlState = {
      overlay: 'commentary',
      overlayParams: {},
    };
    const hash = buildUrlHash(state);
    expect(hash).toBe('#overlay=commentary');
  });

  it('builds hash with verse', () => {
    const state: UrlState = {
      verse: 'Genesis.1.1',
      overlayParams: {},
    };
    const hash = buildUrlHash(state);
    expect(hash).toBe('#verse=Genesis.1.1');
  });

  it('omits default zoom (1.0)', () => {
    const state: UrlState = {
      zoom: 1.0,
      overlayParams: {},
    };
    const hash = buildUrlHash(state);
    expect(hash).toBe('');
  });

  it('includes non-default zoom', () => {
    const state: UrlState = {
      zoom: 2.5,
      overlayParams: {},
    };
    const hash = buildUrlHash(state);
    expect(hash).toBe('#zoom=2.5');
  });

  it('rounds zoom to 2 decimal places and strips trailing zeros', () => {
    const state: UrlState = {
      zoom: 1.234567,
      overlayParams: {},
    };
    let hash = buildUrlHash(state);
    expect(hash).toBe('#zoom=1.23');

    // Test trailing zero removal
    state.zoom = 2.0;
    hash = buildUrlHash(state);
    expect(hash).toBe('#zoom=2');

    state.zoom = 2.10;
    hash = buildUrlHash(state);
    expect(hash).toBe('#zoom=2.1');
  });

  it('includes pan positions when no verse is specified', () => {
    const state: UrlState = {
      x: 100.5,
      y: -50.25,
      overlayParams: {},
    };
    const hash = buildUrlHash(state);
    expect(hash).toContain('x=100.5');
    expect(hash).toContain('y=-50.3'); // Rounded to 1 decimal
  });

  it('rounds pan positions to 1 decimal place and strips trailing zeros', () => {
    const state: UrlState = {
      x: 100.0,
      y: 50.567,
      overlayParams: {},
    };
    const hash = buildUrlHash(state);
    expect(hash).toContain('x=100');
    expect(hash).toContain('y=50.6');
  });

  it('omits pan when verse is specified', () => {
    const state: UrlState = {
      verse: 'Genesis.1.1',
      x: 100,
      y: 200,
      overlayParams: {},
    };
    const hash = buildUrlHash(state);
    expect(hash).not.toContain('x=');
    expect(hash).not.toContain('y=');
    expect(hash).toContain('verse=Genesis.1.1');
  });

  it('includes trop parameter', () => {
    const state: UrlState = {
      overlay: 'trop',
      overlayParams: {
        trop: 'etnachta',
      },
    };
    const hash = buildUrlHash(state);
    expect(hash).toContain('overlay=trop');
    expect(hash).toContain('trop=etnachta');
  });

  it('includes category parameter (non-all)', () => {
    const state: UrlState = {
      overlay: 'commentary',
      overlayParams: {
        category: 'Midrash',
      },
    };
    const hash = buildUrlHash(state);
    expect(hash).toContain('category=Midrash');
  });

  it('omits overlay parameters with an empty value', () => {
    // Overlays leave a setting out entirely when it is at its default, so an
    // empty string means "nothing to say" rather than "set to empty".
    const state: UrlState = {
      overlay: 'commentary',
      overlayParams: {
        category: '',
      },
    };
    const hash = buildUrlHash(state);
    expect(hash).not.toContain('category=');
  });

  it('refuses overlay parameters that would collide with core keys', () => {
    const state: UrlState = {
      overlay: 'commentary',
      zoom: 2,
      overlayParams: {
        zoom: '9',
        verse: 'Genesis.1.1',
      },
    };
    const hash = buildUrlHash(state);
    expect(hash).toContain('zoom=2');
    expect(hash).not.toContain('zoom=9');
    expect(hash).not.toContain('verse=');
  });

  it('includes search query', () => {
    const state: UrlState = {
      overlay: 'search',
      overlayParams: {
        q: 'בראשית',
      },
    };
    const hash = buildUrlHash(state);
    expect(hash).toContain('overlay=search');
    expect(hash).toContain('q=');
  });

  it('encodes special characters in search query', () => {
    const state: UrlState = {
      overlay: 'search',
      overlayParams: {
        q: 'test & special',
      },
    };
    const hash = buildUrlHash(state);
    expect(hash).toContain('q=test+%26+special');
  });

  it('builds complete hash with multiple parameters', () => {
    const state: UrlState = {
      overlay: 'commentary',
      verse: 'Exodus.20.1',
      zoom: 3.5,
      overlayParams: {
        category: 'Talmud',
      },
    };
    const hash = buildUrlHash(state);
    expect(hash).toContain('overlay=commentary');
    expect(hash).toContain('verse=Exodus.20.1');
    expect(hash).toContain('zoom=3.5');
    expect(hash).toContain('category=Talmud');
  });

  it('handles negative pan positions', () => {
    const state: UrlState = {
      x: -100,
      y: -200,
      overlayParams: {},
    };
    const hash = buildUrlHash(state);
    expect(hash).toContain('x=-100');
    expect(hash).toContain('y=-200');
  });

  it('handles zero pan positions', () => {
    const state: UrlState = {
      x: 0,
      y: 0,
      overlayParams: {},
    };
    const hash = buildUrlHash(state);
    expect(hash).toContain('x=0');
    expect(hash).toContain('y=0');
  });
});

describe('parseUrlState and buildUrlHash roundtrip', () => {
  it('roundtrips minimal state', () => {
    const original: UrlState = { overlayParams: {} };
    const hash = buildUrlHash(original);
    mockWindowLocation(`http://localhost:5173/${hash}`);
    const parsed = parseUrlState(overlayUrlParams);
    expect(parsed).toEqual(original);
  });

  it('roundtrips full state', () => {
    const original: UrlState = {
      overlay: 'commentary',
      verse: 'Psalms.23.1',
      zoom: 2.5,
      overlayParams: {
        category: 'Midrash',
      },
    };
    const hash = buildUrlHash(original);
    mockWindowLocation(`http://localhost:5173/${hash}`);
    const parsed = parseUrlState(overlayUrlParams);
    expect(parsed).toEqual(original);
  });

  it('roundtrips trop overlay', () => {
    const original: UrlState = {
      overlay: 'trop',
      overlayParams: {
        trop: 'sof-pasuk',
      },
    };
    const hash = buildUrlHash(original);
    mockWindowLocation(`http://localhost:5173/${hash}`);
    const parsed = parseUrlState(overlayUrlParams);
    expect(parsed).toEqual(original);
  });

  it('roundtrips search overlay with Hebrew', () => {
    const original: UrlState = {
      overlay: 'search',
      overlayParams: {
        q: 'בראשית',
      },
    };
    const hash = buildUrlHash(original);
    mockWindowLocation(`http://localhost:5173/${hash}`);
    const parsed = parseUrlState(overlayUrlParams);
    expect(parsed).toEqual(original);
  });

  it('roundtrips pan positions', () => {
    const original: UrlState = {
      x: 100.5,
      y: -50.2, // Will be rounded to -50.2
      overlayParams: {},
    };
    const hash = buildUrlHash(original);
    mockWindowLocation(`http://localhost:5173/${hash}`);
    const parsed = parseUrlState(overlayUrlParams);
    expect(parsed.x).toBe(100.5);
    expect(parsed.y).toBe(-50.2);
  });
});

describe('updateUrl', () => {
  beforeEach(() => {
    mockWindowLocation('http://localhost:5173/');
    globalThis.history = {
      pushState: vi.fn(),
      replaceState: vi.fn(),
    } as any;
  });

  it('replaces state by default', () => {
    const state: UrlState = {
      overlay: 'commentary',
      overlayParams: {},
    };
    updateUrl(state);
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/#overlay=commentary');
    expect(history.pushState).not.toHaveBeenCalled();
  });

  it('pushes state when requested', () => {
    const state: UrlState = {
      verse: 'Genesis.1.1',
      overlayParams: {},
    };
    updateUrl(state, true);
    expect(history.pushState).toHaveBeenCalledWith(null, '', '/#verse=Genesis.1.1');
    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it('preserves pathname and search params', () => {
    mockWindowLocation('http://localhost:5173/index.html?debug=true');
    const state: UrlState = {
      overlay: 'trop',
      overlayParams: {},
    };
    updateUrl(state);
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/index.html?debug=true#overlay=trop');
  });

  it('removes hash when state is empty', () => {
    const state: UrlState = {
      overlayParams: {},
    };
    updateUrl(state);
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/');
  });
});

describe('verseToUrlFormat', () => {
  it('converts simple book name', () => {
    const result = verseToUrlFormat('Genesis', 1, 1);
    expect(result).toBe('Genesis.1.1');
  });

  it('converts book name with spaces', () => {
    const result = verseToUrlFormat('I Samuel', 1, 5);
    expect(result).toBe('I.Samuel.1.5');
  });

  it('converts book name with multiple spaces', () => {
    const result = verseToUrlFormat('Song of Songs', 2, 3);
    expect(result).toBe('Song.of.Songs.2.3');
  });

  it('handles large chapter and verse numbers', () => {
    const result = verseToUrlFormat('Psalms', 119, 176);
    expect(result).toBe('Psalms.119.176');
  });

  it('handles book names already with dots (edge case)', () => {
    const result = verseToUrlFormat('I. Samuel', 1, 1);
    expect(result).toBe('I..Samuel.1.1');
  });
});

describe('parseVerseFromUrl', () => {
  it('parses simple verse reference', () => {
    const result = parseVerseFromUrl('Genesis.1.1');
    expect(result).toEqual({
      book: 'Genesis',
      chapter: 1,
      verse: 1,
    });
  });

  it('parses verse with dotted book name', () => {
    const result = parseVerseFromUrl('I.Samuel.1.5');
    expect(result).toEqual({
      book: 'I Samuel',
      chapter: 1,
      verse: 5,
    });
  });

  it('parses verse with multi-word book name', () => {
    const result = parseVerseFromUrl('Song.of.Songs.2.3');
    expect(result).toEqual({
      book: 'Song of Songs',
      chapter: 2,
      verse: 3,
    });
  });

  it('handles large chapter and verse numbers', () => {
    const result = parseVerseFromUrl('Psalms.119.176');
    expect(result).toEqual({
      book: 'Psalms',
      chapter: 119,
      verse: 176,
    });
  });

  it('returns null for malformed input (too few parts)', () => {
    expect(parseVerseFromUrl('Genesis.1')).toBeNull();
    expect(parseVerseFromUrl('Genesis')).toBeNull();
    expect(parseVerseFromUrl('1.1')).toBeNull();
  });

  it('returns null for non-numeric chapter', () => {
    const result = parseVerseFromUrl('Genesis.abc.1');
    expect(result).toBeNull();
  });

  it('returns null for non-numeric verse', () => {
    const result = parseVerseFromUrl('Genesis.1.abc');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseVerseFromUrl('')).toBeNull();
  });

  it('returns null when book name is missing', () => {
    expect(parseVerseFromUrl('.1.1')).toBeNull();
  });

  it('handles edge case with consecutive dots in book', () => {
    const result = parseVerseFromUrl('I..Samuel.1.1');
    expect(result).toEqual({
      book: 'I  Samuel', // Double dot becomes double space when joined
      chapter: 1,
      verse: 1,
    });
  });
});

describe('verseToUrlFormat and parseVerseFromUrl roundtrip', () => {
  it('roundtrips simple book', () => {
    const url = verseToUrlFormat('Genesis', 1, 1);
    const parsed = parseVerseFromUrl(url);
    expect(parsed).toEqual({
      book: 'Genesis',
      chapter: 1,
      verse: 1,
    });
  });

  it('roundtrips book with spaces', () => {
    const url = verseToUrlFormat('I Samuel', 10, 25);
    const parsed = parseVerseFromUrl(url);
    expect(parsed).toEqual({
      book: 'I Samuel',
      chapter: 10,
      verse: 25,
    });
  });

  it('roundtrips multi-word book', () => {
    const url = verseToUrlFormat('Song of Songs', 8, 14);
    const parsed = parseVerseFromUrl(url);
    expect(parsed).toEqual({
      book: 'Song of Songs',
      chapter: 8,
      verse: 14,
    });
  });
});

describe('subscribeToHashChange', () => {
  beforeEach(() => {
    if (typeof window === 'undefined') {
      (globalThis as any).window = {};
    }
    window.addEventListener = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('subscribes to popstate event', () => {
    const callback = vi.fn();
    subscribeToHashChange(callback);
    expect(window.addEventListener).toHaveBeenCalledWith('popstate', callback);
  });

  it('subscribes to hashchange event', () => {
    const callback = vi.fn();
    subscribeToHashChange(callback);
    expect(window.addEventListener).toHaveBeenCalledWith('popstate', callback);
    expect(window.addEventListener).toHaveBeenCalledWith('hashchange', callback);
  });
});

describe('backward compatibility', () => {
  it('handles old URL format without overlay prefix', () => {
    // Old format might have been just the overlay name
    mockWindowLocation('http://localhost:5173/#commentary');
    const state = parseUrlState(overlayUrlParams);
    // Should parse as empty since it's not a valid param
    expect(state).toEqual({ overlayParams: {} });
  });

  it('handles URLs with only verse (common sharing pattern)', () => {
    mockWindowLocation('http://localhost:5173/#verse=Psalms.23.1');
    const state = parseUrlState(overlayUrlParams);
    expect(state.verse).toBe('Psalms.23.1');
    expect(state.overlay).toBeUndefined();
  });

  it('gracefully handles malformed zoom values from old URLs', () => {
    mockWindowLocation('http://localhost:5173/#zoom=2.5x');
    const state = parseUrlState(overlayUrlParams);
    // parseFloat('2.5x') returns 2.5, which is valid
    expect(state.zoom).toBe(2.5);
  });

  it('handles legacy category names', () => {
    // Assuming categories haven't changed, but testing robustness
    mockWindowLocation('http://localhost:5173/#overlay=commentary&category=Legacy%20Category');
    const state = parseUrlState(overlayUrlParams);
    expect(state.overlayParams.category).toBe('Legacy Category');
  });
});

describe('special character encoding', () => {
  it('handles Hebrew characters in search queries', () => {
    const state: UrlState = {
      overlay: 'search',
      overlayParams: {
        q: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים',
      },
    };
    const hash = buildUrlHash(state);
    mockWindowLocation(`http://localhost:5173/${hash}`);
    const parsed = parseUrlState(overlayUrlParams);
    expect(parsed.overlayParams.q).toBe('בְּרֵאשִׁית בָּרָא אֱלֹהִים');
  });

  it('handles ampersands in search queries', () => {
    const state: UrlState = {
      overlay: 'search',
      overlayParams: {
        q: 'heaven & earth',
      },
    };
    const hash = buildUrlHash(state);
    mockWindowLocation(`http://localhost:5173/${hash}`);
    const parsed = parseUrlState(overlayUrlParams);
    expect(parsed.overlayParams.q).toBe('heaven & earth');
  });

  it('handles quotes in search queries', () => {
    const state: UrlState = {
      overlay: 'search',
      overlayParams: {
        q: '"In the beginning"',
      },
    };
    const hash = buildUrlHash(state);
    mockWindowLocation(`http://localhost:5173/${hash}`);
    const parsed = parseUrlState(overlayUrlParams);
    expect(parsed.overlayParams.q).toBe('"In the beginning"');
  });

  it('handles special punctuation in search', () => {
    const state: UrlState = {
      overlay: 'search',
      overlayParams: {
        q: 'word1, word2; word3!',
      },
    };
    const hash = buildUrlHash(state);
    mockWindowLocation(`http://localhost:5173/${hash}`);
    const parsed = parseUrlState(overlayUrlParams);
    expect(parsed.overlayParams.q).toBe('word1, word2; word3!');
  });

  it('handles plus signs in search queries', () => {
    const state: UrlState = {
      overlay: 'search',
      overlayParams: {
        q: 'word+with+plus',
      },
    };
    const hash = buildUrlHash(state);
    mockWindowLocation(`http://localhost:5173/${hash}`);
    const parsed = parseUrlState(overlayUrlParams);
    expect(parsed.overlayParams.q).toBe('word+with+plus');
  });

  it('handles equals signs in search queries', () => {
    const state: UrlState = {
      overlay: 'search',
      overlayParams: {
        q: 'test=value',
      },
    };
    const hash = buildUrlHash(state);
    mockWindowLocation(`http://localhost:5173/${hash}`);
    const parsed = parseUrlState(overlayUrlParams);
    expect(parsed.overlayParams.q).toBe('test=value');
  });

  it('handles slashes in category names', () => {
    const state: UrlState = {
      overlay: 'commentary',
      overlayParams: {
        category: 'Talmud/Mishnah',
      },
    };
    const hash = buildUrlHash(state);
    mockWindowLocation(`http://localhost:5173/${hash}`);
    const parsed = parseUrlState(overlayUrlParams);
    expect(parsed.overlayParams.category).toBe('Talmud/Mishnah');
  });
});

describe('edge cases and error handling', () => {
  it('handles very long search queries', () => {
    const longQuery = 'a'.repeat(1000);
    const state: UrlState = {
      overlay: 'search',
      overlayParams: { q: longQuery },
    };
    const hash = buildUrlHash(state);
    mockWindowLocation(`http://localhost:5173/${hash}`);
    const parsed = parseUrlState(overlayUrlParams);
    expect(parsed.overlayParams.q).toBe(longQuery);
  });

  it('handles extreme zoom values at boundaries', () => {
    mockWindowLocation('http://localhost:5173/#zoom=0.1');
    let state = parseUrlState(overlayUrlParams);
    expect(state.zoom).toBe(0.1);

    mockWindowLocation('http://localhost:5173/#zoom=10');
    state = parseUrlState(overlayUrlParams);
    expect(state.zoom).toBe(10);

    mockWindowLocation('http://localhost:5173/#zoom=0.09999');
    state = parseUrlState(overlayUrlParams);
    expect(state.zoom).toBeUndefined();

    mockWindowLocation('http://localhost:5173/#zoom=10.0001');
    state = parseUrlState(overlayUrlParams);
    expect(state.zoom).toBeUndefined();
  });

  it('handles very large pan positions', () => {
    mockWindowLocation('http://localhost:5173/#x=999999&y=-999999');
    const state = parseUrlState(overlayUrlParams);
    expect(state.x).toBe(999999);
    expect(state.y).toBe(-999999);
  });

  it('handles decimal pan positions', () => {
    mockWindowLocation('http://localhost:5173/#x=123.456789&y=987.654321');
    const state = parseUrlState(overlayUrlParams);
    expect(state.x).toBe(123.456789);
    expect(state.y).toBe(987.654321);
  });

  it('handles empty overlay parameter', () => {
    mockWindowLocation('http://localhost:5173/#overlay=');
    const state = parseUrlState(overlayUrlParams);
    expect(state.overlay).toBeUndefined();
  });

  it('handles multiple question marks (malformed)', () => {
    mockWindowLocation('http://localhost:5173/#overlay=trop&trop=???');
    const state = parseUrlState(overlayUrlParams);
    expect(state.overlayParams.trop).toBe('???');
  });

  it('preserves exact trop mark names', () => {
    const tropMarks = ['sof-pasuk', 'etnachta', 'segol', 'zakef-katan', 'pashta'];
    tropMarks.forEach(trop => {
      const state: UrlState = {
        overlay: 'trop',
        overlayParams: { trop },
      };
      const hash = buildUrlHash(state);
      mockWindowLocation(`http://localhost:5173/${hash}`);
      const parsed = parseUrlState(overlayUrlParams);
      expect(parsed.overlayParams.trop).toBe(trop);
    });
  });

  it('handles verse references with very large numbers', () => {
    const verse = verseToUrlFormat('Psalms', 119, 176);
    const parsed = parseVerseFromUrl(verse);
    expect(parsed).toEqual({
      book: 'Psalms',
      chapter: 119,
      verse: 176,
    });
  });

  it('handles verse references with zero (invalid but handled)', () => {
    const parsed = parseVerseFromUrl('Genesis.0.0');
    expect(parsed).toEqual({
      book: 'Genesis',
      chapter: 0,
      verse: 0,
    });
    // Note: validation of whether chapter/verse exist is separate concern
  });

  it('handles multiple consecutive dots in verse', () => {
    const parsed = parseVerseFromUrl('Genesis..1.1');
    expect(parsed).toEqual({
      book: 'Genesis ', // Dot becomes space when parts are joined
      chapter: 1,
      verse: 1,
    });
  });

  it('handles URL with hash but no parameters', () => {
    mockWindowLocation('http://localhost:5173/#');
    const state = parseUrlState(overlayUrlParams);
    expect(state).toEqual({ overlayParams: {} });
  });

  it('handles duplicate parameters (URLSearchParams takes first)', () => {
    mockWindowLocation('http://localhost:5173/#overlay=trop&overlay=search');
    const state = parseUrlState(overlayUrlParams);
    expect(state.overlay).toBe('trop'); // URLSearchParams.get() returns first value
  });
});

describe('overlay-supplied parameters', () => {
  it('reads only the keys the active overlay declares', () => {
    // "trop" belongs to the trop overlay, not to search
    mockWindowLocation('http://localhost:5173/#overlay=search&q=light&trop=etnachta');
    const state = parseUrlState(overlayUrlParams);
    expect(state.overlayParams).toEqual({ q: 'light' });
  });

  it('ignores keys no overlay declared', () => {
    mockWindowLocation('http://localhost:5173/#overlay=trop&trop=etnachta&nonsense=1');
    const state = parseUrlState(overlayUrlParams);
    expect(state.overlayParams).toEqual({ trop: 'etnachta' });
  });

  it('reads nothing for an overlay that declares no parameters', () => {
    mockWindowLocation('http://localhost:5173/#overlay=text-dating&q=light');
    const state = parseUrlState(overlayUrlParams);
    expect(state.overlayParams).toEqual({});
  });

  it('reads nothing when no overlay is active', () => {
    mockWindowLocation('http://localhost:5173/#q=light&trop=etnachta');
    const state = parseUrlState(overlayUrlParams);
    expect(state.overlayParams).toEqual({});
  });

  it('reads nothing when given no lookup at all', () => {
    mockWindowLocation('http://localhost:5173/#overlay=trop&trop=etnachta');
    const state = parseUrlState();
    expect(state.overlay).toBe('trop');
    expect(state.overlayParams).toEqual({});
  });

  it('rejects a value outside the set the overlay allows', () => {
    mockWindowLocation('http://localhost:5173/#overlay=search&q=light&hm=sideways');
    const state = parseUrlState(overlayUrlParams);
    expect(state.overlayParams.hm).toBeUndefined();
    expect(state.overlayParams.q).toBe('light');
  });

  it('accepts every value in the set the overlay allows', () => {
    for (const mode of ['substring', 'word', 'root']) {
      mockWindowLocation(`http://localhost:5173/#overlay=search&q=light&hm=${mode}`);
      const state = parseUrlState(overlayUrlParams);
      expect(state.overlayParams.hm).toBe(mode);
    }
  });

  it('refuses an overlay key that collides with a core key', () => {
    const collidingLookup = () => [{ key: 'zoom', kind: 'token' } as const];
    mockWindowLocation('http://localhost:5173/#overlay=trop&zoom=3');
    const state = parseUrlState(collidingLookup);
    expect(state.zoom).toBe(3);
    expect(state.overlayParams).toEqual({});
  });

  it('writes back whatever the overlay reported, without inspecting it', () => {
    const state: UrlState = {
      overlay: 'brand-new-overlay',
      overlayParams: { anything: 'at all', another: '7' },
    };
    const hash = buildUrlHash(state);
    expect(hash).toContain('anything=at+all');
    expect(hash).toContain('another=7');
  });
});

describe('what every overlay must hold to', () => {
  // The point of the redesign: an overlay that saves settings has to say which
  // keys it uses, or urlState.ts will never read them back out of a link.
  ALL_OVERLAYS.forEach((overlay) => {
    const savesSettings = Boolean(overlay.getUrlParams || overlay.applyUrlParams);

    it(`${overlay.id}: declares its keys if it saves any settings`, () => {
      if (savesSettings) {
        expect(overlay.urlParams, `${overlay.id} has no urlParams`).toBeDefined();
        expect(overlay.urlParams!.length).toBeGreaterThan(0);
      } else {
        expect(overlay.urlParams).toBeUndefined();
      }
    });

    it(`${overlay.id}: uses distinct keys that do not clash with the view state`, () => {
      const keys = (overlay.urlParams ?? []).map((spec) => spec.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const key of keys) {
        expect(['story', 'overlay', 'verse', 'zoom', 'x', 'y']).not.toContain(key);
      }
    });

    it(`${overlay.id}: only reports settings under keys it declared`, () => {
      const declared = new Set((overlay.urlParams ?? []).map((spec) => spec.key));
      const reported = Object.keys(overlay.getUrlParams?.() ?? {});
      for (const key of reported) {
        expect(declared, `${overlay.id} reported undeclared "${key}"`).toContain(key);
      }
    });
  });
});

describe('haftarah custom in the URL (issue #66)', () => {
  it('parses the Sephardi custom', () => {
    mockWindowLocation('http://localhost:5173/#overlay=haftarah&custom=sephardi');
    const state = parseUrlState(overlayUrlParams);
    expect(state.overlayParams.custom).toBe('sephardi');
  });

  it('parses the Ashkenazi custom', () => {
    mockWindowLocation('http://localhost:5173/#overlay=haftarah&custom=ashkenazi');
    const state = parseUrlState(overlayUrlParams);
    expect(state.overlayParams.custom).toBe('ashkenazi');
  });

  it('rejects a custom that is not one of the two', () => {
    mockWindowLocation('http://localhost:5173/#overlay=haftarah&custom=yemenite');
    const state = parseUrlState(overlayUrlParams);
    expect(state.overlayParams.custom).toBeUndefined();
  });

  it('roundtrips the Sephardi custom', () => {
    const original: UrlState = {
      overlay: 'haftarah',
      overlayParams: { custom: 'sephardi' },
    };
    const hash = buildUrlHash(original);
    expect(hash).toContain('custom=sephardi');
    mockWindowLocation(`http://localhost:5173/${hash}`);
    expect(parseUrlState(overlayUrlParams)).toEqual(original);
  });
});

describe('links shared before this refactor still work', () => {
  // Every parameter name the app has ever written into a hash, parsed with the
  // overlay declarations the app ships with today.
  const legacyLinks: Array<[string, Record<string, string>]> = [
    ['#overlay=trop&trop=etnachta', { trop: 'etnachta' }],
    ['#overlay=commentary&category=Midrash', { category: 'Midrash' }],
    ['#overlay=commentary&category=Jewish%20Thought', { category: 'Jewish Thought' }],
    ['#overlay=search&q=%D7%91%D7%A8%D7%90%D7%A9%D7%99%D7%AA', { q: 'בראשית' }],
    ['#overlay=search&q=light&ww=1', { q: 'light', ww: '1' }],
    ['#overlay=search&q=light&ww=1&hm=root', { q: 'light', ww: '1', hm: 'root' }],
  ];

  legacyLinks.forEach(([hash, expected]) => {
    it(`parses ${hash}`, () => {
      mockWindowLocation(`http://localhost:5173/${hash}`);
      const state = parseUrlState(overlayUrlParams);
      expect(state.overlayParams).toEqual(expected);
    });
  });

  it('reads the older "cat" spelling and stores it under the current key', () => {
    mockWindowLocation('http://localhost:5173/#overlay=commentary&cat=Talmud');
    const state = parseUrlState(overlayUrlParams);
    expect(state.overlayParams).toEqual({ category: 'Talmud' });
  });

  it('prefers the current spelling when a link carries both', () => {
    mockWindowLocation(
      'http://localhost:5173/#overlay=commentary&cat=Talmud&category=Midrash',
    );
    const state = parseUrlState(overlayUrlParams);
    expect(state.overlayParams).toEqual({ category: 'Midrash' });
  });

  it('writes only the current spelling back out', () => {
    mockWindowLocation('http://localhost:5173/#overlay=commentary&cat=Talmud');
    const hash = buildUrlHash(parseUrlState(overlayUrlParams));
    expect(hash).toContain('category=Talmud');
    expect(hash).not.toMatch(/[#&]cat=/);
  });

  it('keeps a full legacy link intact through a parse and rebuild', () => {
    const hash = '#overlay=commentary&verse=Exodus.20.1&zoom=3&category=Talmud';
    mockWindowLocation(`http://localhost:5173/${hash}`);
    const state = parseUrlState(overlayUrlParams);
    const rebuilt = buildUrlHash(state);
    expect(rebuilt).toContain('overlay=commentary');
    expect(rebuilt).toContain('verse=Exodus.20.1');
    expect(rebuilt).toContain('zoom=3');
    expect(rebuilt).toContain('category=Talmud');
  });
});
