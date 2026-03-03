import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';
import {
  parseUrlState,
  buildUrlHash,
  updateUrl,
  verseToUrlFormat,
  parseVerseFromUrl,
  debounce,
  subscribeToHashChange,
  type UrlState,
} from '../../urlState';
import { mockWindowLocation } from '../helpers/mocks';

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
    const state = parseUrlState();
    expect(state).toEqual({
      overlayParams: {},
    });
  });

  it('parses overlay parameter', () => {
    mockWindowLocation('http://localhost:5173/#overlay=commentary');
    const state = parseUrlState();
    expect(state.overlay).toBe('commentary');
  });

  it('parses verse parameter', () => {
    mockWindowLocation('http://localhost:5173/#verse=Genesis.1.1');
    const state = parseUrlState();
    expect(state.verse).toBe('Genesis.1.1');
  });

  it('parses zoom parameter within valid range', () => {
    mockWindowLocation('http://localhost:5173/#zoom=2.5');
    const state = parseUrlState();
    expect(state.zoom).toBe(2.5);
  });

  it('rejects zoom below minimum (0.1)', () => {
    mockWindowLocation('http://localhost:5173/#zoom=0.05');
    const state = parseUrlState();
    expect(state.zoom).toBeUndefined();
  });

  it('rejects zoom above maximum (10)', () => {
    mockWindowLocation('http://localhost:5173/#zoom=15');
    const state = parseUrlState();
    expect(state.zoom).toBeUndefined();
  });

  it('accepts zoom at boundary (0.1)', () => {
    mockWindowLocation('http://localhost:5173/#zoom=0.1');
    const state = parseUrlState();
    expect(state.zoom).toBe(0.1);
  });

  it('accepts zoom at boundary (10)', () => {
    mockWindowLocation('http://localhost:5173/#zoom=10');
    const state = parseUrlState();
    expect(state.zoom).toBe(10);
  });

  it('rejects non-numeric zoom', () => {
    mockWindowLocation('http://localhost:5173/#zoom=abc');
    const state = parseUrlState();
    expect(state.zoom).toBeUndefined();
  });

  it('parses x and y pan positions', () => {
    mockWindowLocation('http://localhost:5173/#x=100.5&y=-50.25');
    const state = parseUrlState();
    expect(state.x).toBe(100.5);
    expect(state.y).toBe(-50.25);
  });

  it('rejects non-numeric x and y', () => {
    mockWindowLocation('http://localhost:5173/#x=abc&y=def');
    const state = parseUrlState();
    expect(state.x).toBeUndefined();
    expect(state.y).toBeUndefined();
  });

  it('parses trop overlay parameter', () => {
    mockWindowLocation('http://localhost:5173/#overlay=trop&trop=etnachta');
    const state = parseUrlState();
    expect(state.overlay).toBe('trop');
    expect(state.overlayParams.trop).toBe('etnachta');
  });

  it('parses category overlay parameter', () => {
    mockWindowLocation('http://localhost:5173/#overlay=commentary&category=Midrash');
    const state = parseUrlState();
    expect(state.overlay).toBe('commentary');
    expect(state.overlayParams.category).toBe('Midrash');
  });

  it('parses search query parameter', () => {
    mockWindowLocation('http://localhost:5173/#overlay=search&q=בראשית');
    const state = parseUrlState();
    expect(state.overlay).toBe('search');
    expect(state.overlayParams.q).toBe('בראשית');
  });

  it('parses search query with special characters', () => {
    mockWindowLocation('http://localhost:5173/#overlay=search&q=%D7%91%D7%A8%D7%90%D7%A9%D7%99%D7%AA');
    const state = parseUrlState();
    expect(state.overlayParams.q).toBe('בראשית');
  });

  it('parses search query with spaces', () => {
    mockWindowLocation('http://localhost:5173/#overlay=search&q=In%20the%20beginning');
    const state = parseUrlState();
    expect(state.overlayParams.q).toBe('In the beginning');
  });

  it('parses complete state with all parameters', () => {
    mockWindowLocation('http://localhost:5173/#overlay=commentary&verse=Exodus.20.1&zoom=3&category=Talmud');
    const state = parseUrlState();
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
    const state = parseUrlState();
    // Empty strings should be ignored
    expect(state.overlay).toBeUndefined();
    expect(state.verse).toBeUndefined();
    expect(state.zoom).toBeUndefined();
  });

  it('ignores unknown parameters', () => {
    mockWindowLocation('http://localhost:5173/#overlay=trop&unknown=value&another=param');
    const state = parseUrlState();
    expect(state.overlay).toBe('trop');
    expect((state as any).unknown).toBeUndefined();
  });

  it('handles negative zoom (invalid)', () => {
    mockWindowLocation('http://localhost:5173/#zoom=-1');
    const state = parseUrlState();
    expect(state.zoom).toBeUndefined();
  });

  it('handles zero zoom (invalid)', () => {
    mockWindowLocation('http://localhost:5173/#zoom=0');
    const state = parseUrlState();
    expect(state.zoom).toBeUndefined();
  });

  it('handles negative pan positions', () => {
    mockWindowLocation('http://localhost:5173/#x=-100&y=-200');
    const state = parseUrlState();
    expect(state.x).toBe(-100);
    expect(state.y).toBe(-200);
  });

  it('handles verse with dots in book name', () => {
    mockWindowLocation('http://localhost:5173/#verse=I.Samuel.1.1');
    const state = parseUrlState();
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

  it('omits category parameter when set to "all"', () => {
    const state: UrlState = {
      overlay: 'commentary',
      overlayParams: {
        category: 'all',
      },
    };
    const hash = buildUrlHash(state);
    expect(hash).not.toContain('category=');
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
    const parsed = parseUrlState();
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
    const parsed = parseUrlState();
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
    const parsed = parseUrlState();
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
    const parsed = parseUrlState();
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
    const parsed = parseUrlState();
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

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('delays function execution', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resets timer on subsequent calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);
    debounced(); // Reset timer
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes arguments correctly', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('arg1', 'arg2', 123);
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 123);
  });

  it('handles multiple rapid calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    debounced();
    debounced();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('allows multiple executions if enough time passes', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);

    debounced();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('uses latest arguments when called multiple times', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('first');
    debounced('second');
    debounced('third');

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith('third');
    expect(fn).toHaveBeenCalledTimes(1);
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
    const state = parseUrlState();
    // Should parse as empty since it's not a valid param
    expect(state).toEqual({ overlayParams: {} });
  });

  it('handles URLs with only verse (common sharing pattern)', () => {
    mockWindowLocation('http://localhost:5173/#verse=Psalms.23.1');
    const state = parseUrlState();
    expect(state.verse).toBe('Psalms.23.1');
    expect(state.overlay).toBeUndefined();
  });

  it('gracefully handles malformed zoom values from old URLs', () => {
    mockWindowLocation('http://localhost:5173/#zoom=2.5x');
    const state = parseUrlState();
    // parseFloat('2.5x') returns 2.5, which is valid
    expect(state.zoom).toBe(2.5);
  });

  it('handles legacy category names', () => {
    // Assuming categories haven't changed, but testing robustness
    mockWindowLocation('http://localhost:5173/#overlay=commentary&category=Legacy%20Category');
    const state = parseUrlState();
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
    const parsed = parseUrlState();
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
    const parsed = parseUrlState();
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
    const parsed = parseUrlState();
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
    const parsed = parseUrlState();
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
    const parsed = parseUrlState();
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
    const parsed = parseUrlState();
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
    const parsed = parseUrlState();
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
    const parsed = parseUrlState();
    expect(parsed.overlayParams.q).toBe(longQuery);
  });

  it('handles extreme zoom values at boundaries', () => {
    mockWindowLocation('http://localhost:5173/#zoom=0.1');
    let state = parseUrlState();
    expect(state.zoom).toBe(0.1);

    mockWindowLocation('http://localhost:5173/#zoom=10');
    state = parseUrlState();
    expect(state.zoom).toBe(10);

    mockWindowLocation('http://localhost:5173/#zoom=0.09999');
    state = parseUrlState();
    expect(state.zoom).toBeUndefined();

    mockWindowLocation('http://localhost:5173/#zoom=10.0001');
    state = parseUrlState();
    expect(state.zoom).toBeUndefined();
  });

  it('handles very large pan positions', () => {
    mockWindowLocation('http://localhost:5173/#x=999999&y=-999999');
    const state = parseUrlState();
    expect(state.x).toBe(999999);
    expect(state.y).toBe(-999999);
  });

  it('handles decimal pan positions', () => {
    mockWindowLocation('http://localhost:5173/#x=123.456789&y=987.654321');
    const state = parseUrlState();
    expect(state.x).toBe(123.456789);
    expect(state.y).toBe(987.654321);
  });

  it('handles empty overlay parameter', () => {
    mockWindowLocation('http://localhost:5173/#overlay=');
    const state = parseUrlState();
    expect(state.overlay).toBeUndefined();
  });

  it('handles multiple question marks (malformed)', () => {
    mockWindowLocation('http://localhost:5173/#overlay=trop&trop=???');
    const state = parseUrlState();
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
      const parsed = parseUrlState();
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
    const state = parseUrlState();
    expect(state).toEqual({ overlayParams: {} });
  });

  it('handles duplicate parameters (URLSearchParams takes first)', () => {
    mockWindowLocation('http://localhost:5173/#overlay=trop&overlay=search');
    const state = parseUrlState();
    expect(state.overlay).toBe('trop'); // URLSearchParams.get() returns first value
  });
});
