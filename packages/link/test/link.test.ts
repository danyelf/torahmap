import { describe, it, expect } from 'vitest';
import {
  readLink,
  writeLink,
  verseToUrlFormat,
  parseVerseFromUrl,
  validateOverlayParams,
  type UrlState,
  type UrlParamSpec,
  type OverlayParamSpecLookup,
} from '../src/index.ts';

// Stand-ins for the real overlays' declarations (commentary, trop, haftarah),
// which this package cannot import.
const lookup: OverlayParamSpecLookup = (id) => {
  switch (id) {
    case 'commentary':
      return [{ key: 'category', kind: 'category', default: 'total' }];
    case 'trop':
      return [{ key: 'trop', kind: 'token' }];
    case 'haftarah':
      return [
        { key: 'custom', kind: 'token', allowed: ['ashkenazi', 'sephardi'], default: 'ashkenazi' },
      ];
    default:
      return undefined;
  }
};

describe('readLink', () => {
  it('parses empty query to minimal state', () => {
    const state = readLink('', lookup);
    expect(state).toEqual({
      overlayParams: {},
    });
  });

  it('parses a camera-only query with no overlay', () => {
    const state = readLink('?zoom=4&x=100&y=200', lookup);

    expect(state.zoom).toBe(4);
    expect(state.overlay).toBeUndefined();
  });

  it('parses overlay parameter', () => {
    const state = readLink('?overlay=commentary', lookup);
    expect(state.overlay).toBe('commentary');
  });

  it('parses verse parameter', () => {
    const state = readLink('?verse=Genesis.1.1', lookup);
    expect(state.verse).toBe('Genesis.1.1');
  });

  it('parses zoom parameter within valid range', () => {
    const state = readLink('?zoom=2.5', lookup);
    expect(state.zoom).toBe(2.5);
  });

  it('rejects zoom below minimum (0.1)', () => {
    const state = readLink('?zoom=0.05', lookup);
    expect(state.zoom).toBeUndefined();
  });

  it('rejects zoom above maximum (10)', () => {
    const state = readLink('?zoom=15', lookup);
    expect(state.zoom).toBeUndefined();
  });

  it('accepts zoom at boundary (0.1)', () => {
    const state = readLink('?zoom=0.1', lookup);
    expect(state.zoom).toBe(0.1);
  });

  it('accepts zoom at boundary (10)', () => {
    const state = readLink('?zoom=10', lookup);
    expect(state.zoom).toBe(10);
  });

  it('rejects non-numeric zoom', () => {
    const state = readLink('?zoom=abc', lookup);
    expect(state.zoom).toBeUndefined();
  });

  it('parses x and y pan positions', () => {
    const state = readLink('?x=100.5&y=-50.25', lookup);
    expect(state.x).toBe(100.5);
    expect(state.y).toBe(-50.25);
  });

  it('rejects non-numeric x and y', () => {
    const state = readLink('?x=abc&y=def', lookup);
    expect(state.x).toBeUndefined();
    expect(state.y).toBeUndefined();
  });

  it('parses trop overlay parameter', () => {
    const state = readLink('?overlay=trop&trop=etnachta', lookup);
    expect(state.overlay).toBe('trop');
    expect(state.overlayParams.trop).toBe('etnachta');
  });

  it('parses category overlay parameter', () => {
    const state = readLink('?overlay=commentary&category=Midrash', lookup);
    expect(state.overlay).toBe('commentary');
    expect(state.overlayParams.category).toBe('Midrash');
  });

  it('parses search query parameter', () => {
    const state = readLink('?search=בראשית', lookup);
    expect(state.overlay).toBeUndefined();
    expect(state.searchParams?.search).toBe('בראשית');
  });

  it('parses search query with special characters', () => {
    const state = readLink('?search=%D7%91%D7%A8%D7%90%D7%A9%D7%99%D7%AA', lookup);
    expect(state.searchParams?.search).toBe('בראשית');
  });

  it('parses search query with spaces', () => {
    const state = readLink('?search=In%20the%20beginning', lookup);
    expect(state.searchParams?.search).toBe('In the beginning');
  });

  it('parses complete state with all parameters', () => {
    const state = readLink('?overlay=commentary&verse=Exodus.20.1&zoom=3&category=Talmud', lookup);
    expect(state).toEqual({
      overlay: 'commentary',
      verse: 'Exodus.20.1',
      zoom: 3,
      overlayParams: {
        category: 'Talmud',
      },
    });
  });

  it('handles malformed query with missing values', () => {
    const state = readLink('?overlay=&verse=&zoom=', lookup);
    // Empty strings should be ignored
    expect(state.overlay).toBeUndefined();
    expect(state.verse).toBeUndefined();
    expect(state.zoom).toBeUndefined();
  });

  it('ignores unknown parameters', () => {
    const state = readLink('?overlay=trop&unknown=value&another=param', lookup);
    expect(state.overlay).toBe('trop');
    expect((state as any).unknown).toBeUndefined();
  });

  it('handles negative zoom (invalid)', () => {
    const state = readLink('?zoom=-1', lookup);
    expect(state.zoom).toBeUndefined();
  });

  it('handles zero zoom (invalid)', () => {
    const state = readLink('?zoom=0', lookup);
    expect(state.zoom).toBeUndefined();
  });

  it('handles negative pan positions', () => {
    const state = readLink('?x=-100&y=-200', lookup);
    expect(state.x).toBe(-100);
    expect(state.y).toBe(-200);
  });

  it('handles verse with dots in book name', () => {
    const state = readLink('?verse=I.Samuel.1.1', lookup);
    expect(state.verse).toBe('I.Samuel.1.1');
  });
});

describe('writeLink', () => {
  it('builds empty query for minimal state', () => {
    const state: UrlState = {
      overlayParams: {},
    };
    expect(writeLink(state)).toBe('');
  });

  it('builds query with overlay', () => {
    const state: UrlState = {
      overlay: 'commentary',
      overlayParams: {},
    };
    expect(writeLink(state)).toBe('?overlay=commentary');
  });

  it('builds query with verse', () => {
    const state: UrlState = {
      verse: 'Genesis.1.1',
      overlayParams: {},
    };
    expect(writeLink(state)).toBe('?verse=Genesis.1.1');
  });

  it('omits default zoom (1.0)', () => {
    const state: UrlState = {
      zoom: 1.0,
      overlayParams: {},
    };
    expect(writeLink(state)).toBe('');
  });

  it('includes non-default zoom', () => {
    const state: UrlState = {
      zoom: 2.5,
      overlayParams: {},
    };
    expect(writeLink(state)).toBe('?zoom=2.5');
  });

  it('rounds zoom to 2 decimal places and strips trailing zeros', () => {
    const state: UrlState = {
      zoom: 1.234567,
      overlayParams: {},
    };
    expect(writeLink(state)).toBe('?zoom=1.23');

    state.zoom = 2.0;
    expect(writeLink(state)).toBe('?zoom=2');

    state.zoom = 2.1;
    expect(writeLink(state)).toBe('?zoom=2.1');
  });

  it('includes pan positions when no verse is specified', () => {
    const state: UrlState = {
      x: 100.5,
      y: -50.25,
      overlayParams: {},
    };
    const query = writeLink(state);
    expect(query).toContain('x=100.5');
    expect(query).toContain('y=-50.3'); // Rounded to 1 decimal
  });

  it('rounds pan positions to 1 decimal place and strips trailing zeros', () => {
    const state: UrlState = {
      x: 100.0,
      y: 50.567,
      overlayParams: {},
    };
    const query = writeLink(state);
    expect(query).toContain('x=100');
    expect(query).toContain('y=50.6');
  });

  it('omits pan when verse is specified', () => {
    const state: UrlState = {
      verse: 'Genesis.1.1',
      x: 100,
      y: 200,
      overlayParams: {},
    };
    const query = writeLink(state);
    expect(query).not.toContain('x=');
    expect(query).not.toContain('y=');
    expect(query).toContain('verse=Genesis.1.1');
  });

  it('includes trop parameter', () => {
    const state: UrlState = {
      overlay: 'trop',
      overlayParams: {
        trop: 'etnachta',
      },
    };
    const query = writeLink(state);
    expect(query).toContain('overlay=trop');
    expect(query).toContain('trop=etnachta');
  });

  it('includes category parameter (non-all)', () => {
    const state: UrlState = {
      overlay: 'commentary',
      overlayParams: {
        category: 'Midrash',
      },
    };
    expect(writeLink(state)).toContain('category=Midrash');
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
    expect(writeLink(state)).not.toContain('category=');
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
    const query = writeLink(state);
    expect(query).toContain('zoom=2');
    expect(query).not.toContain('zoom=9');
    expect(query).not.toContain('verse=');
  });

  it('includes search query', () => {
    const state: UrlState = {
      searchParams: { search: 'בראשית' },
      overlayParams: {},
    };
    const query = writeLink(state);
    expect(query).not.toContain('overlay=');
    expect(query).toContain('search=');
  });

  it('encodes special characters in search query', () => {
    const state: UrlState = {
      searchParams: { search: 'test & special' },
      overlayParams: {},
    };
    expect(writeLink(state)).toContain('search=test+%26+special');
  });

  it('builds complete query with multiple parameters', () => {
    const state: UrlState = {
      overlay: 'commentary',
      verse: 'Exodus.20.1',
      zoom: 3.5,
      overlayParams: {
        category: 'Talmud',
      },
    };
    const query = writeLink(state);
    expect(query).toContain('overlay=commentary');
    expect(query).toContain('verse=Exodus.20.1');
    expect(query).toContain('zoom=3.5');
    expect(query).toContain('category=Talmud');
  });

  it('handles negative pan positions', () => {
    const state: UrlState = {
      x: -100,
      y: -200,
      overlayParams: {},
    };
    const query = writeLink(state);
    expect(query).toContain('x=-100');
    expect(query).toContain('y=-200');
  });

  it('handles zero pan positions', () => {
    const state: UrlState = {
      x: 0,
      y: 0,
      overlayParams: {},
    };
    const query = writeLink(state);
    expect(query).toContain('x=0');
    expect(query).toContain('y=0');
  });
});

describe('readLink and writeLink roundtrip', () => {
  it('roundtrips minimal state', () => {
    const original: UrlState = { overlayParams: {} };
    const parsed = readLink(writeLink(original), lookup);
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
    const parsed = readLink(writeLink(original), lookup);
    expect(parsed).toEqual(original);
  });

  it('roundtrips trop overlay', () => {
    const original: UrlState = {
      overlay: 'trop',
      overlayParams: {
        trop: 'sof-pasuk',
      },
    };
    const parsed = readLink(writeLink(original), lookup);
    expect(parsed).toEqual(original);
  });

  it('roundtrips search overlay with Hebrew', () => {
    const original: UrlState = {
      searchParams: { search: 'בראשית' },
      overlayParams: {},
    };
    const parsed = readLink(writeLink(original), lookup);
    expect(parsed).toEqual(original);
  });

  it('roundtrips pan positions', () => {
    const original: UrlState = {
      x: 100.5,
      y: -50.2, // Will be rounded to -50.2
      overlayParams: {},
    };
    const parsed = readLink(writeLink(original), lookup);
    expect(parsed.x).toBe(100.5);
    expect(parsed.y).toBe(-50.2);
  });
});

describe('a story in the link', () => {
  it('writes a story and its stop together', () => {
    expect(writeLink({ story: 'tour', stop: 'abraham_call', overlayParams: {} })).toBe(
      '?story=tour&stop=abraham_call',
    );
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

describe('backward compatibility', () => {
  it('ignores a bare fragment that names no parameter', () => {
    const state = readLink('?commentary', lookup);
    // Should parse as empty since it's not a valid param
    expect(state).toEqual({ overlayParams: {} });
  });

  it('handles queries with only verse (common sharing pattern)', () => {
    const state = readLink('?verse=Psalms.23.1', lookup);
    expect(state.verse).toBe('Psalms.23.1');
    expect(state.overlay).toBeUndefined();
  });

  it('gracefully handles malformed zoom values from old links', () => {
    const state = readLink('?zoom=2.5x', lookup);
    // parseFloat('2.5x') returns 2.5, which is valid
    expect(state.zoom).toBe(2.5);
  });

  it('accepts a category name containing a space', () => {
    const state = readLink('?overlay=commentary&category=Modern%20Commentary', lookup);
    expect(state.overlayParams.category).toBe('Modern Commentary');
  });
});

describe('special character encoding', () => {
  it('handles Hebrew characters in search queries', () => {
    const state: UrlState = {
      searchParams: { search: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים' },
      overlayParams: {},
    };
    const parsed = readLink(writeLink(state), lookup);
    expect(parsed.searchParams?.search).toBe('בְּרֵאשִׁית בָּרָא אֱלֹהִים');
  });

  it('handles ampersands in search queries', () => {
    const state: UrlState = {
      searchParams: { search: 'heaven & earth' },
      overlayParams: {},
    };
    const parsed = readLink(writeLink(state), lookup);
    expect(parsed.searchParams?.search).toBe('heaven & earth');
  });

  it('handles quotes in search queries', () => {
    const state: UrlState = {
      searchParams: { search: '"In the beginning"' },
      overlayParams: {},
    };
    const parsed = readLink(writeLink(state), lookup);
    expect(parsed.searchParams?.search).toBe('"In the beginning"');
  });

  it('handles special punctuation in search', () => {
    const state: UrlState = {
      searchParams: { search: 'word1, word2; word3!' },
      overlayParams: {},
    };
    const parsed = readLink(writeLink(state), lookup);
    expect(parsed.searchParams?.search).toBe('word1, word2; word3!');
  });

  it('handles plus signs in search queries', () => {
    const state: UrlState = {
      searchParams: { search: 'word+with+plus' },
      overlayParams: {},
    };
    const parsed = readLink(writeLink(state), lookup);
    expect(parsed.searchParams?.search).toBe('word+with+plus');
  });

  it('handles equals signs in search queries', () => {
    const state: UrlState = {
      searchParams: { search: 'test=value' },
      overlayParams: {},
    };
    const parsed = readLink(writeLink(state), lookup);
    expect(parsed.searchParams?.search).toBe('test=value');
  });

  it('handles slashes in category names', () => {
    const state: UrlState = {
      overlay: 'commentary',
      overlayParams: {
        category: 'Talmud/Mishnah',
      },
    };
    const parsed = readLink(writeLink(state), lookup);
    expect(parsed.overlayParams.category).toBe('Talmud/Mishnah');
  });
});

describe('edge cases and error handling', () => {
  it('handles very long search queries', () => {
    const longQuery = 'a'.repeat(1000);
    const state: UrlState = {
      searchParams: { search: longQuery },
      overlayParams: {},
    };
    const parsed = readLink(writeLink(state), lookup);
    expect(parsed.searchParams?.search).toBe(longQuery);
  });

  it('handles extreme zoom values at boundaries', () => {
    expect(readLink('?zoom=0.1', lookup).zoom).toBe(0.1);
    expect(readLink('?zoom=10', lookup).zoom).toBe(10);
    expect(readLink('?zoom=0.09999', lookup).zoom).toBeUndefined();
    expect(readLink('?zoom=10.0001', lookup).zoom).toBeUndefined();
  });

  it('handles very large pan positions', () => {
    const state = readLink('?x=999999&y=-999999', lookup);
    expect(state.x).toBe(999999);
    expect(state.y).toBe(-999999);
  });

  it('handles decimal pan positions', () => {
    const state = readLink('?x=123.456789&y=987.654321', lookup);
    expect(state.x).toBe(123.456789);
    expect(state.y).toBe(987.654321);
  });

  it('handles empty overlay parameter', () => {
    const state = readLink('?overlay=', lookup);
    expect(state.overlay).toBeUndefined();
  });

  it('handles multiple question marks (malformed)', () => {
    const state = readLink('?overlay=trop&trop=???', lookup);
    expect(state.overlayParams.trop).toBe('???');
  });

  it('preserves exact trop mark names', () => {
    const tropMarks = ['sof-pasuk', 'etnachta', 'segol', 'zakef-katan', 'pashta'];
    tropMarks.forEach((trop) => {
      const state: UrlState = {
        overlay: 'trop',
        overlayParams: { trop },
      };
      const parsed = readLink(writeLink(state), lookup);
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

  it('handles a query with no parameters', () => {
    const state = readLink('', lookup);
    expect(state).toEqual({ overlayParams: {} });
  });

  it('handles duplicate parameters (URLSearchParams takes first)', () => {
    const state = readLink('?overlay=trop&overlay=search', lookup);
    expect(state.overlay).toBe('trop'); // URLSearchParams.get() returns first value
  });
});

describe('overlay-supplied parameters', () => {
  it('reads only the keys the active overlay declares', () => {
    // "category" belongs to commentary, not to trop
    const state = readLink('?overlay=trop&trop=etnachta&category=x', lookup);
    expect(state.overlayParams).toEqual({ trop: 'etnachta' });
  });

  it('ignores keys no overlay declared', () => {
    const state = readLink('?overlay=trop&trop=etnachta&nonsense=1', lookup);
    expect(state.overlayParams).toEqual({ trop: 'etnachta' });
  });

  it('reads nothing for an overlay that declares no parameters', () => {
    const state = readLink('?overlay=text-dating&search=light', lookup);
    expect(state.overlayParams).toEqual({});
  });

  it('reads nothing when no overlay is active', () => {
    const state = readLink('?search=light&trop=etnachta', lookup);
    expect(state.overlayParams).toEqual({});
  });

  it('reads nothing when given no lookup at all', () => {
    const state = readLink('?overlay=trop&trop=etnachta');
    expect(state.overlay).toBe('trop');
    expect(state.overlayParams).toEqual({});
  });

  it('falls back to the default when the value is outside the set the overlay allows', () => {
    const state = readLink('?overlay=haftarah&custom=yemenite', lookup);
    expect(state.overlayParams.custom).toBe('ashkenazi');
  });

  it('accepts every value in the set the overlay allows', () => {
    for (const custom of ['ashkenazi', 'sephardi']) {
      const state = readLink(`?overlay=haftarah&custom=${custom}`, lookup);
      expect(state.overlayParams.custom).toBe(custom);
    }
  });

  it('refuses an overlay key that collides with a core key', () => {
    const collidingLookup = () => [{ key: 'zoom', kind: 'token' } as const];
    const state = readLink('?overlay=trop&zoom=3', collidingLookup);
    expect(state.zoom).toBe(3);
    expect(state.overlayParams).toEqual({});
  });

  it('writes back whatever the overlay reported, without inspecting it', () => {
    const state: UrlState = {
      overlay: 'brand-new-overlay',
      overlayParams: { anything: 'at all', another: '7' },
    };
    const query = writeLink(state);
    expect(query).toContain('anything=at+all');
    expect(query).toContain('another=7');
  });
});

describe('validateOverlayParams defaults', () => {
  const specs = [
    { key: 'category', kind: 'category', default: 'total' },
    { key: 'note', kind: 'token' },
  ] as const satisfies readonly UrlParamSpec[];

  it('fills a declared default when the key is absent', () => {
    expect(validateOverlayParams(specs, {})).toEqual({ category: 'total' });
  });

  it('fills a declared default when the value is rejected', () => {
    expect(validateOverlayParams(specs, { category: '<script>' })).toEqual({
      category: 'total',
    });
  });

  it('prefers a valid supplied value over the default', () => {
    expect(validateOverlayParams(specs, { category: 'Midrash' })).toEqual({
      category: 'Midrash',
    });
  });

  it('leaves a key with no declared default absent', () => {
    expect(validateOverlayParams(specs, {})).not.toHaveProperty('note');
  });
});

describe('the search in a link', () => {
  it('is read whatever overlay is on', () => {
    const state = readLink('?overlay=commentary&search=אברם&mode=w', lookup);
    expect(state.overlay).toBe('commentary');
    expect(state.searchParams).toEqual({ search: 'אברם', mode: 'w' });
  });

  it('is left out of a link that does not search', () => {
    expect(readLink('?overlay=commentary', lookup).searchParams).toBeUndefined();
  });

  it('is written first, before the overlay it sits over', () => {
    const query = writeLink({
      searchParams: { search: 'אברם' },
      overlay: 'commentary',
      overlayParams: { category: 'Liturgy' },
    });
    expect(query).toBe(`?search=${encodeURIComponent('אברם')}&overlay=commentary&category=Liturgy`);
  });
});

describe('haftarah custom in the link', () => {
  it('parses the Sephardi custom', () => {
    const state = readLink('?overlay=haftarah&custom=sephardi', lookup);
    expect(state.overlayParams.custom).toBe('sephardi');
  });

  it('parses the Ashkenazi custom', () => {
    const state = readLink('?overlay=haftarah&custom=ashkenazi', lookup);
    expect(state.overlayParams.custom).toBe('ashkenazi');
  });

  it('falls back to Ashkenazi for a custom that is not one of the two', () => {
    const state = readLink('?overlay=haftarah&custom=yemenite', lookup);
    expect(state.overlayParams.custom).toBe('ashkenazi');
  });

  it('roundtrips the Sephardi custom', () => {
    const original: UrlState = {
      overlay: 'haftarah',
      overlayParams: { custom: 'sephardi' },
    };
    const query = writeLink(original);
    expect(query).toContain('custom=sephardi');
    expect(readLink(query, lookup)).toEqual(original);
  });
});

describe('whole links, parsed against overlay declarations', () => {
  const links: Array<[string, Record<string, string>]> = [
    ['?overlay=trop&trop=etnachta', { trop: 'etnachta' }],
    ['?overlay=commentary&category=Midrash', { category: 'Midrash' }],
    ['?overlay=commentary&category=Jewish%20Thought', { category: 'Jewish Thought' }],
  ];

  links.forEach(([query, expected]) => {
    it(`parses ${query}`, () => {
      const state = readLink(query, lookup);
      expect(state.overlayParams).toEqual(expected);
    });
  });

  it('keeps a full link intact through a parse and rebuild', () => {
    const query = '?overlay=commentary&verse=Exodus.20.1&zoom=3&category=Talmud';
    const rebuilt = writeLink(readLink(query, lookup));
    expect(rebuilt).toContain('overlay=commentary');
    expect(rebuilt).toContain('verse=Exodus.20.1');
    expect(rebuilt).toContain('zoom=3');
    expect(rebuilt).toContain('category=Talmud');
  });
});

describe('whole links that search', () => {
  const links: Array<[string, Record<string, string>]> = [
    ['?search=%D7%91%D7%A8%D7%90%D7%A9%D7%99%D7%AA', { search: 'בראשית' }],
    ['?search=light&mode=w', { search: 'light', mode: 'w' }],
    ['?search=light,%D7%A2%D7%9C%D7%94&mode=w,r', { search: 'light,עלה', mode: 'w,r' }],
  ];

  links.forEach(([query, expected]) => {
    it(`parses ${query}`, () => {
      const state = readLink(query, lookup);
      expect(state.searchParams).toEqual(expected);
      expect(state.overlayParams).toEqual({});
    });
  });
});
