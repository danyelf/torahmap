import { describe, it, expect } from 'vitest';
import {
  parseUrlState,
  parseVerseFromUrl,
} from '../../urlState';
import { mockWindowLocation } from '../helpers/mocks';

describe('URL Parameter Security Validation', () => {
  describe('XSS Prevention', () => {
    it('rejects verse parameter with HTML tags', () => {
      mockWindowLocation('http://localhost:5173/#verse=<script>alert(1)</script>');
      const state = parseUrlState();
      expect(state.verse).toBeUndefined();
    });

    it('rejects verse parameter with javascript: protocol', () => {
      mockWindowLocation('http://localhost:5173/#verse=javascript:alert(1)');
      const state = parseUrlState();
      expect(state.verse).toBeUndefined();
    });

    it('rejects overlay parameter with HTML tags', () => {
      mockWindowLocation('http://localhost:5173/#overlay=<img src=x onerror=alert(1)>');
      const state = parseUrlState();
      expect(state.overlay).toBeUndefined();
    });

    it('rejects trop parameter with HTML tags', () => {
      mockWindowLocation('http://localhost:5173/#overlay=trop&trop=<script>alert(1)</script>');
      const state = parseUrlState();
      expect(state.overlayParams.trop).toBeUndefined();
    });

    it('rejects category parameter with HTML tags', () => {
      mockWindowLocation('http://localhost:5173/#overlay=commentary&category=<img src=x>');
      const state = parseUrlState();
      expect(state.overlayParams.category).toBeUndefined();
    });

    it('sanitizes search query with HTML tags by encoding them', () => {
      // Search queries should preserve user input but safely encode it
      // The overlay itself should handle display sanitization
      mockWindowLocation('http://localhost:5173/#overlay=search&q=<script>alert(1)</script>');
      const state = parseUrlState();
      // We allow the raw value but expect consumers to sanitize when displaying
      expect(state.overlayParams.q).toBeDefined();
      expect(state.overlayParams.q).not.toContain('<script>');
    });
  });

  describe('Verse Format Validation', () => {
    it('accepts valid verse with alphanumeric book name', () => {
      const result = parseVerseFromUrl('Genesis.1.1');
      expect(result).not.toBeNull();
      expect(result?.book).toBe('Genesis');
    });

    it('accepts valid verse with Roman numerals in book name', () => {
      const result = parseVerseFromUrl('I.Samuel.1.1');
      expect(result).not.toBeNull();
      expect(result?.book).toBe('I Samuel');
    });

    it('rejects verse with invalid characters in book name', () => {
      expect(parseVerseFromUrl('<script>.1.1')).toBeNull();
      expect(parseVerseFromUrl('Genesis<script>.1.1')).toBeNull();
      expect(parseVerseFromUrl('Gen/esis.1.1')).toBeNull();
      expect(parseVerseFromUrl('Gen\\esis.1.1')).toBeNull();
    });

    it('rejects verse with negative chapter number', () => {
      expect(parseVerseFromUrl('Genesis.-1.1')).toBeNull();
    });

    it('rejects verse with negative verse number', () => {
      expect(parseVerseFromUrl('Genesis.1.-1')).toBeNull();
    });

    it('rejects verse with excessively large chapter number', () => {
      // No book has more than 200 chapters
      expect(parseVerseFromUrl('Genesis.999999.1')).toBeNull();
    });

    it('rejects verse with excessively large verse number', () => {
      // No chapter has more than 200 verses
      expect(parseVerseFromUrl('Genesis.1.999999')).toBeNull();
    });

    it('rejects verse with non-integer chapter', () => {
      expect(parseVerseFromUrl('Genesis.1.5.1')).toBeNull();
    });

    it('rejects verse with floating point numbers', () => {
      expect(parseVerseFromUrl('Genesis.1.5.5')).toBeNull();
      expect(parseVerseFromUrl('Genesis.1.1.1.1')).toBeNull();
    });
  });

  describe('Pan Position Bounds', () => {
    it('accepts reasonable pan positions', () => {
      mockWindowLocation('http://localhost:5173/#x=500&y=300');
      const state = parseUrlState();
      expect(state.x).toBe(500);
      expect(state.y).toBe(300);
    });

    it('rejects excessively large positive pan positions', () => {
      // MAX_PAN_POSITION is 1000000, so test beyond that
      mockWindowLocation('http://localhost:5173/#x=10000000&y=10000000');
      const state = parseUrlState();
      expect(state.x).toBeUndefined();
      expect(state.y).toBeUndefined();
    });

    it('rejects excessively large negative pan positions', () => {
      mockWindowLocation('http://localhost:5173/#x=-10000000&y=-10000000');
      const state = parseUrlState();
      expect(state.x).toBeUndefined();
      expect(state.y).toBeUndefined();
    });

    it('accepts pan positions at reasonable bounds', () => {
      // Test that values within MAX_PAN_POSITION work
      mockWindowLocation('http://localhost:5173/#x=999999&y=-999999');
      const state = parseUrlState();
      expect(state.x).toBe(999999);
      expect(state.y).toBe(-999999);
    });

    it('rejects Infinity as pan position', () => {
      mockWindowLocation('http://localhost:5173/#x=Infinity&y=-Infinity');
      const state = parseUrlState();
      expect(state.x).toBeUndefined();
      expect(state.y).toBeUndefined();
    });

    it('rejects NaN as pan position', () => {
      mockWindowLocation('http://localhost:5173/#x=NaN&y=NaN');
      const state = parseUrlState();
      expect(state.x).toBeUndefined();
      expect(state.y).toBeUndefined();
    });
  });

  describe('Overlay Name Validation', () => {
    it('accepts valid overlay names', () => {
      const validOverlays = ['commentary', 'trop', 'search'];
      validOverlays.forEach(overlay => {
        mockWindowLocation(`http://localhost:5173/#overlay=${overlay}`);
        const state = parseUrlState();
        expect(state.overlay).toBe(overlay);
      });
    });

    it('accepts unknown overlay names for forward/backward compatibility', () => {
      mockWindowLocation('http://localhost:5173/#overlay=future-overlay');
      const state = parseUrlState();
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
      invalidOverlays.forEach(overlay => {
        mockWindowLocation(`http://localhost:5173/#overlay=${encodeURIComponent(overlay)}`);
        const state = parseUrlState();
        expect(state.overlay).toBeUndefined();
      });
    });

    it('rejects excessively long overlay names', () => {
      const longOverlay = 'a'.repeat(100);
      mockWindowLocation(`http://localhost:5173/#overlay=${longOverlay}`);
      const state = parseUrlState();
      expect(state.overlay).toBeUndefined();
    });

    it('accepts overlay name with hyphens', () => {
      mockWindowLocation('http://localhost:5173/#overlay=text-dating');
      const state = parseUrlState();
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
      validCategories.forEach(category => {
        mockWindowLocation(`http://localhost:5173/#overlay=commentary&category=${encodeURIComponent(category)}`);
        const state = parseUrlState();
        expect(state.overlayParams.category).toBe(category);
      });
    });

    it('rejects category with special characters', () => {
      mockWindowLocation('http://localhost:5173/#overlay=commentary&category=Test<script>');
      const state = parseUrlState();
      expect(state.overlayParams.category).toBeUndefined();
    });

    it('rejects excessively long category names', () => {
      const longCategory = 'a'.repeat(100);
      mockWindowLocation(`http://localhost:5173/#overlay=commentary&category=${longCategory}`);
      const state = parseUrlState();
      expect(state.overlayParams.category).toBeUndefined();
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
      validTrops.forEach(trop => {
        mockWindowLocation(`http://localhost:5173/#overlay=trop&trop=${trop}`);
        const state = parseUrlState();
        expect(state.overlayParams.trop).toBe(trop);
      });
    });

    it('rejects trop with special characters', () => {
      mockWindowLocation('http://localhost:5173/#overlay=trop&trop=test<script>');
      const state = parseUrlState();
      expect(state.overlayParams.trop).toBeUndefined();
    });

    it('rejects excessively long trop names', () => {
      const longTrop = 'a'.repeat(100);
      mockWindowLocation(`http://localhost:5173/#overlay=trop&trop=${longTrop}`);
      const state = parseUrlState();
      expect(state.overlayParams.trop).toBeUndefined();
    });
  });

  describe('Search Query Validation', () => {
    it('accepts search query with Hebrew text', () => {
      mockWindowLocation('http://localhost:5173/#overlay=search&q=%D7%91%D7%A8%D7%90%D7%A9%D7%99%D7%AA');
      const state = parseUrlState();
      expect(state.overlayParams.q).toBe('בראשית');
    });

    it('accepts search query with English text', () => {
      mockWindowLocation('http://localhost:5173/#overlay=search&q=beginning');
      const state = parseUrlState();
      expect(state.overlayParams.q).toBe('beginning');
    });

    it('limits search query length', () => {
      const longQuery = 'a'.repeat(10000);
      mockWindowLocation(`http://localhost:5173/#overlay=search&q=${longQuery}`);
      const state = parseUrlState();
      // Should either truncate or reject excessively long queries
      if (state.overlayParams.q) {
        expect(state.overlayParams.q.length).toBeLessThanOrEqual(1000);
      } else {
        expect(state.overlayParams.q).toBeUndefined();
      }
    });

    it('strips HTML tags from search query', () => {
      mockWindowLocation('http://localhost:5173/#overlay=search&q=<script>alert(1)</script>test');
      const state = parseUrlState();
      if (state.overlayParams.q) {
        expect(state.overlayParams.q).not.toContain('<script>');
        expect(state.overlayParams.q).not.toContain('</script>');
      }
    });
  });

  describe('Empty and Whitespace Values', () => {
    it('rejects empty overlay parameter', () => {
      mockWindowLocation('http://localhost:5173/#overlay=');
      const state = parseUrlState();
      expect(state.overlay).toBeUndefined();
    });

    it('rejects whitespace-only overlay parameter', () => {
      mockWindowLocation('http://localhost:5173/#overlay=%20%20%20');
      const state = parseUrlState();
      expect(state.overlay).toBeUndefined();
    });

    it('rejects empty verse parameter', () => {
      mockWindowLocation('http://localhost:5173/#verse=');
      const state = parseUrlState();
      expect(state.verse).toBeUndefined();
    });

    it('rejects whitespace-only verse parameter', () => {
      mockWindowLocation('http://localhost:5173/#verse=%20%20%20');
      const state = parseUrlState();
      expect(state.verse).toBeUndefined();
    });
  });
});
