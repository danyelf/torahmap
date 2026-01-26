import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests for the cleanText function in bundle-texts.ts
 * This function strips HTML tags and entities from Sefaria verse text.
 */

// Copied from scripts/bundle-texts.ts
function cleanText(text: string): string {
  return text
    .replace(/<sup[^>]*>[\s\S]*?<\/sup>/g, '') // Remove footnote markers
    .replace(/<i>([^<]*)<\/i>/g, '$1') // Flatten nested <i> tags (keep content)
    .replace(/<i class="footnote">[\s\S]*?<\/i>/g, '') // Remove footnotes (now without nested tags)
    .replace(/<br\s*\/?>/gi, ' ') // Convert <br> to space (for poetry)
    .replace(/<[^>]+>/g, '') // Remove remaining HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with regular space
    .replace(/&[a-z]+;/g, ' ') // Replace other HTML entities with space
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

describe('cleanText', () => {
  describe('HTML entity handling', () => {
    it('replaces &thinsp; with space (fixes tm-1my bug)', () => {
      const input = 'אֲמָרַ֖י הַאֲזִ֥ינָה&thinsp;<small>׀</small>&thinsp;יְהֹוָ֗ה בִּ֣ינָה הֲגִיגִֽי׃';
      const result = cleanText(input);

      // Should have proper spacing around the vertical bar
      expect(result).toBe('אֲמָרַ֖י הַאֲזִ֥ינָה ׀ יְהֹוָ֗ה בִּ֣ינָה הֲגִיגִֽי׃');

      // Should not have text run together
      expect(result).not.toContain('׀י'); // Should not be adjacent
      expect(result).toContain(' ׀ '); // Should have spaces around
    });

    it('replaces &nbsp; with space', () => {
      const input = 'word1&nbsp;word2';
      const result = cleanText(input);
      expect(result).toBe('word1 word2');
    });

    it('handles multiple consecutive HTML entities', () => {
      const input = 'a&thinsp;&thinsp;&nbsp;b';
      const result = cleanText(input);
      expect(result).toBe('a b'); // Multiple spaces normalized to one
    });
  });

  describe('HTML tag removal', () => {
    it('removes <big> tags while preserving content', () => {
      const input = '<big>בְּ</big>רֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים';
      const result = cleanText(input);
      expect(result).toBe('בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים');
    });

    it('removes <small> tags while preserving content', () => {
      const input = 'כִּ֤י&thinsp;<small>׀</small>&thinsp;לֹ֤א';
      const result = cleanText(input);
      expect(result).toBe('כִּ֤י ׀ לֹ֤א');
    });

    it('removes <b> tags while preserving content', () => {
      const input = 'word <b>bold</b> word';
      const result = cleanText(input);
      expect(result).toBe('word bold word');
    });
  });

  describe('footnote removal', () => {
    it('removes footnote markers (<sup>)', () => {
      const input = 'text<sup class="footnote-marker">*</sup> more text';
      const result = cleanText(input);
      expect(result).toBe('text more text');
    });

    it('removes footnote content (<i class="footnote">)', () => {
      const input = 'When God began to create<sup class="footnote-marker">*</sup><i class="footnote"><b>When God began to create </b>Others "In the beginning God created."</i> heaven';
      const result = cleanText(input);
      expect(result).toBe('When God began to create heaven');
    });

    it('handles nested bold tags within footnotes', () => {
      const input = '<i class="footnote"><b>Hazael…Ben-hadad </b>Two of Aram\'s kings</i>';
      const result = cleanText(input);
      expect(result).toBe('');
    });
  });

  describe('poetry formatting', () => {
    it('converts <br> to space', () => {
      const input = 'Line 1<br>Line 2';
      const result = cleanText(input);
      expect(result).toBe('Line 1 Line 2');
    });

    it('converts <br/> to space', () => {
      const input = 'Line 1<br/>Line 2';
      const result = cleanText(input);
      expect(result).toBe('Line 1 Line 2');
    });

    it('removes poetry span tags', () => {
      const input = '<span class="poetry indentAll">Thus said </span> G<small>OD</small>:<br><span class="poetry indentAll">For three transgressions</span>';
      const result = cleanText(input);
      expect(result).toBe('Thus said GOD: For three transgressions');
    });
  });

  describe('complex real-world examples', () => {
    it('handles Genesis 1:1 with big tag', () => {
      const input = '<big>בְּ</big>רֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃';
      const result = cleanText(input);
      expect(result).toBe('בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃');
    });

    it('handles Psalms 5:2 with small tag and thinsp', () => {
      const input = 'אֲמָרַ֖י הַאֲזִ֥ינָה&thinsp;<small>׀</small>&thinsp;יְהֹוָ֗ה בִּ֣ינָה הֲגִיגִֽי׃';
      const result = cleanText(input);
      expect(result).toBe('אֲמָרַ֖י הַאֲזִ֥ינָה ׀ יְהֹוָ֗ה בִּ֣ינָה הֲגִיגִֽי׃');
    });

    it('handles Amos poetry with complex formatting', () => {
      const input = 'He proclaimed:<br><span class="poetry indentAll"> \nG<small>OD</small>\n </span> roars from Zion,<br><span class="poetry indentAll">Shouts aloud from Jerusalem;</span>';
      const result = cleanText(input);
      expect(result).toBe('He proclaimed: GOD roars from Zion, Shouts aloud from Jerusalem;');
    });

    it('handles verse with footnote, nested tags, and entities', () => {
      const input = '<span class="poetry indentAll">Thus said </span> G<small>OD</small>:<br><span class="poetry indentAll">For three transgressions of Damascus,</span><br><sup class="footnote-marker">b</sup><i class="footnote"><b>the decree </b>Of punishment.</i>';
      const result = cleanText(input);
      expect(result).toBe('Thus said GOD: For three transgressions of Damascus,');
    });
  });

  describe('whitespace normalization', () => {
    it('normalizes multiple spaces to single space', () => {
      const input = 'word1   word2    word3';
      const result = cleanText(input);
      expect(result).toBe('word1 word2 word3');
    });

    it('trims leading and trailing whitespace', () => {
      const input = '  text  ';
      const result = cleanText(input);
      expect(result).toBe('text');
    });

    it('normalizes newlines to space', () => {
      const input = 'line1\nline2\n\nline3';
      const result = cleanText(input);
      expect(result).toBe('line1 line2 line3');
    });
  });

  describe('data quality validation', () => {
    it('ensures Hebrew text contains no English letters', () => {
      // This test validates the actual bundled data file
      const dataPath = path.resolve(__dirname, '../../../public/data/all-texts.json');
      const allTexts = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

      const englishLetterRegex = /[a-zA-Z]/;
      const violations: string[] = [];

      // Check every verse in every book
      for (const [book, chapters] of Object.entries(allTexts)) {
        for (const [chapter, verses] of Object.entries(chapters as Record<string, Record<string, { he: string; en: string }>>)) {
          for (const [verse, text] of Object.entries(verses)) {
            if (typeof text === 'object' && text.he && englishLetterRegex.test(text.he)) {
              violations.push(`${book} ${chapter}:${verse} - Hebrew text contains English: "${text.he}"`);
            }
          }
        }
      }

      // Report first 10 violations for debugging
      if (violations.length > 0) {
        console.error('Found English characters in Hebrew text:');
        violations.slice(0, 10).forEach(v => console.error(`  - ${v}`));
        if (violations.length > 10) {
          console.error(`  ... and ${violations.length - 10} more`);
        }
      }

      expect(violations).toHaveLength(0);
    });

    it('ensures Hebrew text contains Hebrew characters', () => {
      // This test ensures we're not accidentally getting empty or English-only text
      const dataPath = path.resolve(__dirname, '../../../public/data/all-texts.json');
      const allTexts = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

      // Hebrew Unicode range: \u0590-\u05FF (includes letters and cantillation marks)
      const hebrewCharRegex = /[\u0590-\u05FF]/;
      const violations: string[] = [];

      for (const [book, chapters] of Object.entries(allTexts)) {
        for (const [chapter, verses] of Object.entries(chapters as Record<string, Record<string, { he: string; en: string }>>)) {
          for (const [verse, text] of Object.entries(verses)) {
            if (typeof text === 'object' && text.he && !hebrewCharRegex.test(text.he)) {
              // Allow em-dash "—" which marks omitted verses (e.g., Joshua 21:36-37)
              if (text.he.trim() === '—' || text.he.trim() === '--') {
                continue;
              }
              violations.push(`${book} ${chapter}:${verse} - Hebrew text missing Hebrew characters: "${text.he}"`);
            }
          }
        }
      }

      if (violations.length > 0) {
        console.error('Found Hebrew text without Hebrew characters:');
        violations.slice(0, 10).forEach(v => console.error(`  - ${v}`));
      }

      expect(violations).toHaveLength(0);
    });
  });
});
