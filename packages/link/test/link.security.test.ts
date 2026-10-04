import { describe, it, expect } from 'vitest';
import { lookup } from './sampleOverlays.ts';
import { readLink, parseVerseId } from '../src/index.ts';

describe('URL Parameter Security Validation', () => {
  describe('XSS Prevention', () => {
    it('rejects verse parameter with HTML tags', () => {
      const state = readLink('?verse=<script>alert(1)</script>');
      expect(state.verse).toBeUndefined();
    });

    it('rejects verse parameter with javascript: protocol', () => {
      const state = readLink('?verse=javascript:alert(1)');
      expect(state.verse).toBeUndefined();
    });

    it('rejects overlay parameter with HTML tags', () => {
      const state = readLink('?overlay=<img src=x onerror=alert(1)>');
      expect(state.overlay).toBeUndefined();
    });

    it('rejects trop parameter with HTML tags', () => {
      const state = readLink('?overlay=trop&trop=<script>alert(1)</script>', lookup);
      expect(state.overlayParams.trop).toBeUndefined();
    });

    it('rejects category parameter with HTML tags, falling back to the default', () => {
      const state = readLink('?overlay=commentary&category=<img src=x>', lookup);
      expect(state.overlayParams.category).toBe('total');
    });

    it('sanitizes search query with HTML tags by encoding them', () => {
      // Search queries should preserve user input but safely encode it
      // The overlay itself should handle display sanitization
      const state = readLink('?search=<script>alert(1)</script>');
      // We allow the raw value but expect consumers to sanitize when displaying
      expect(state.searchParams?.search).toBeDefined();
      expect(state.searchParams?.search).not.toContain('<script>');
    });
  });

  describe('Verse Format Validation', () => {
    it('accepts valid verse with alphanumeric book name', () => {
      const result = parseVerseId('Genesis.1.1');
      expect(result).not.toBeNull();
      expect(result?.book).toBe('Genesis');
    });

    it('accepts valid verse with Roman numerals in book name', () => {
      const result = parseVerseId('I.Samuel.1.1');
      expect(result).not.toBeNull();
      expect(result?.book).toBe('I Samuel');
    });

    it('rejects verse with invalid characters in book name', () => {
      expect(parseVerseId('<script>.1.1')).toBeNull();
      expect(parseVerseId('Genesis<script>.1.1')).toBeNull();
      expect(parseVerseId('Gen/esis.1.1')).toBeNull();
      expect(parseVerseId('Gen\\esis.1.1')).toBeNull();
    });

    it('rejects verse with negative chapter number', () => {
      expect(parseVerseId('Genesis.-1.1')).toBeNull();
    });

    it('rejects verse with negative verse number', () => {
      expect(parseVerseId('Genesis.1.-1')).toBeNull();
    });

    it('rejects verse with excessively large chapter number', () => {
      // No book has more than 200 chapters
      expect(parseVerseId('Genesis.999999.1')).toBeNull();
    });

    it('rejects verse with excessively large verse number', () => {
      // No chapter has more than 200 verses
      expect(parseVerseId('Genesis.1.999999')).toBeNull();
    });

    it('rejects verse with non-integer chapter', () => {
      expect(parseVerseId('Genesis.1.5.1')).toBeNull();
    });

    it('rejects verse with floating point numbers', () => {
      expect(parseVerseId('Genesis.1.5.5')).toBeNull();
      expect(parseVerseId('Genesis.1.1.1.1')).toBeNull();
    });
  });

  describe('Pan Position Bounds', () => {
    it('accepts reasonable pan positions', () => {
      const state = readLink('?x=500&y=300');
      expect(state.x).toBe(500);
      expect(state.y).toBe(300);
    });

    it('rejects excessively large positive pan positions', () => {
      // MAX_PAN_POSITION is 1000000, so test beyond that
      const state = readLink('?x=10000000&y=10000000');
      expect(state.x).toBeUndefined();
      expect(state.y).toBeUndefined();
    });

    it('rejects excessively large negative pan positions', () => {
      const state = readLink('?x=-10000000&y=-10000000');
      expect(state.x).toBeUndefined();
      expect(state.y).toBeUndefined();
    });

    it('accepts pan positions at reasonable bounds', () => {
      // Test that values within MAX_PAN_POSITION work
      const state = readLink('?x=999999&y=-999999');
      expect(state.x).toBe(999999);
      expect(state.y).toBe(-999999);
    });

    it('rejects Infinity as pan position', () => {
      const state = readLink('?x=Infinity&y=-Infinity');
      expect(state.x).toBeUndefined();
      expect(state.y).toBeUndefined();
    });

    it('rejects NaN as pan position', () => {
      const state = readLink('?x=NaN&y=NaN');
      expect(state.x).toBeUndefined();
      expect(state.y).toBeUndefined();
    });
  });

  describe('Overlay Name Validation', () => {
    it('accepts valid overlay names', () => {
      const validOverlays = ['commentary', 'trop', 'search'];
      validOverlays.forEach((overlay) => {
        const state = readLink(`?overlay=${overlay}`);
        expect(state.overlay).toBe(overlay);
      });
    });

    it('accepts unknown overlay names for forward/backward compatibility', () => {
      const state = readLink('?overlay=future-overlay');
      expect(state.overlay).toBe('future-overlay');
    });

    it('rejects invalid overlay names with special characters', () => {
      const invalidOverlays = [
        'overlay<script>',
        'overlay/path',
        'overlay\\path',
        'overlay;command',
        'overlay|pipe',
      ];
      invalidOverlays.forEach((overlay) => {
        const state = readLink(`?overlay=${encodeURIComponent(overlay)}`);
        expect(state.overlay).toBeUndefined();
      });
    });

    it('rejects excessively long overlay names', () => {
      const longOverlay = 'a'.repeat(100);
      const state = readLink(`?overlay=${longOverlay}`);
      expect(state.overlay).toBeUndefined();
    });

    it('accepts overlay name with hyphens', () => {
      const state = readLink('?overlay=text-dating');
      expect(state.overlay).toBe('text-dating');
    });
  });

  describe('Category Name Validation', () => {
    it('accepts valid category names', () => {
      const validCategories = [
        'Talmud',
        'Midrash',
        'Halakhah',
        'Chasidut',
        'Kabbalah',
        'Jewish Thought',
        'Musar',
        'Responsa',
        'Tanakh',
        'all',
      ];
      validCategories.forEach((category) => {
        const state = readLink(
          `?overlay=commentary&category=${encodeURIComponent(category)}`,
          lookup,
        );
        expect(state.overlayParams.category).toBe(category);
      });
    });

    it('rejects category with special characters, falling back to the default', () => {
      const state = readLink('?overlay=commentary&category=Test<script>', lookup);
      expect(state.overlayParams.category).toBe('total');
    });

    it('rejects excessively long category names, falling back to the default', () => {
      const longCategory = 'a'.repeat(100);
      const state = readLink(`?overlay=commentary&category=${longCategory}`, lookup);
      expect(state.overlayParams.category).toBe('total');
    });
  });

  describe('Trop Name Validation', () => {
    it('accepts valid trop names with hyphens', () => {
      const validTrops = [
        'sof-pasuk',
        'etnachta',
        'segol',
        'zakef-katan',
        'zakef-gadol',
        'tipcha',
        'munach',
        'pashta',
      ];
      validTrops.forEach((trop) => {
        const state = readLink(`?overlay=trop&trop=${trop}`, lookup);
        expect(state.overlayParams.trop).toBe(trop);
      });
    });

    it('rejects trop with special characters', () => {
      const state = readLink('?overlay=trop&trop=test<script>', lookup);
      expect(state.overlayParams.trop).toBeUndefined();
    });

    it('rejects excessively long trop names', () => {
      const longTrop = 'a'.repeat(100);
      const state = readLink(`?overlay=trop&trop=${longTrop}`, lookup);
      expect(state.overlayParams.trop).toBeUndefined();
    });
  });

  describe('Search Query Validation', () => {
    it('accepts search query with Hebrew text', () => {
      const state = readLink('?search=%D7%91%D7%A8%D7%90%D7%A9%D7%99%D7%AA');
      expect(state.searchParams?.search).toBe('בראשית');
    });

    it('accepts search query with English text', () => {
      const state = readLink('?search=beginning');
      expect(state.searchParams?.search).toBe('beginning');
    });

    it('limits search query length', () => {
      const longQuery = 'a'.repeat(10000);
      const state = readLink(`?search=${longQuery}`);
      // Should either truncate or reject excessively long queries
      if (state.searchParams?.search) {
        expect(state.searchParams?.search.length).toBeLessThanOrEqual(1000);
      } else {
        expect(state.searchParams?.search).toBeUndefined();
      }
    });

    it('strips HTML tags from search query', () => {
      const state = readLink('?search=<script>alert(1)</script>test');
      if (state.searchParams?.search) {
        expect(state.searchParams?.search).not.toContain('<script>');
        expect(state.searchParams?.search).not.toContain('</script>');
      }
    });
  });

  describe('Empty and Whitespace Values', () => {
    it('rejects empty overlay parameter', () => {
      const state = readLink('?overlay=');
      expect(state.overlay).toBeUndefined();
    });

    it('rejects whitespace-only overlay parameter', () => {
      const state = readLink('?overlay=%20%20%20');
      expect(state.overlay).toBeUndefined();
    });

    it('rejects empty verse parameter', () => {
      const state = readLink('?verse=');
      expect(state.verse).toBeUndefined();
    });

    it('rejects whitespace-only verse parameter', () => {
      const state = readLink('?verse=%20%20%20');
      expect(state.verse).toBeUndefined();
    });
  });
});
