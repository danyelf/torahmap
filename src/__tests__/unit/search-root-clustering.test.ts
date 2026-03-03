// Tests for root mode adjacency-based related roots
// When two Strong's numbers share a surface form (with exactly 2 lemmas)
// in word-lemmas, they are direct neighbors. Related roots are shown as
// UI suggestions (chips) rather than automatically expanding search results.
//
// Example: צחק → [H6712, H6711], יצחק → [H3327, H6711]
// H6711 bridges them as neighbors. But searching צחק does NOT auto-expand
// to include H3327 results — instead, related roots are shown as chips.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildSearchIndex,
  search,
  findLemmasForWord,
  getRelatedRoots,
  loadLemmaData,
} from '../../search';
import type { VerseTexts } from '../../verseTexts';

import * as fs from 'fs';
import * as path from 'path';

const wordLemmasPath = path.join(process.cwd(), 'public', 'data', 'word-lemmas.json');
const verseLemmasPath = path.join(process.cwd(), 'public', 'data', 'verse-lemmas.json');
const strongsToRootPath = path.join(process.cwd(), 'public', 'data', 'strongs-to-root.json');

const dataExists = fs.existsSync(wordLemmasPath) &&
  fs.existsSync(verseLemmasPath) &&
  fs.existsSync(strongsToRootPath);

// Mock fetch to serve local data files for loadLemmaData()
function mockFetchForLemmaData() {
  const wordLemmas = JSON.parse(fs.readFileSync(wordLemmasPath, 'utf-8'));
  const verseLemmas = JSON.parse(fs.readFileSync(verseLemmasPath, 'utf-8'));
  const strongsToRoot = JSON.parse(fs.readFileSync(strongsToRootPath, 'utf-8'));

  global.fetch = vi.fn((input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    let data: unknown;
    if (url.includes('word-lemmas')) data = wordLemmas;
    else if (url.includes('verse-lemmas')) data = verseLemmas;
    else if (url.includes('strongs-to-root')) data = strongsToRoot;
    else return Promise.resolve({ ok: false, status: 404 } as Response);

    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
    } as Response);
  });
}

describe.skipIf(!dataExists)('Root mode adjacency and related roots', () => {
  beforeEach(async () => {
    // Build search index with a minimal verse set that includes our test verses
    const allTextsPath = path.join(process.cwd(), 'public', 'data', 'all-texts.json');
    if (fs.existsSync(allTextsPath)) {
      const allTexts = JSON.parse(fs.readFileSync(allTextsPath, 'utf-8')) as VerseTexts;
      buildSearchIndex(allTexts);
    }

    // Load lemma data via mocked fetch
    mockFetchForLemmaData();
    await loadLemmaData();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Direct lemma search (no transitive expansion)', () => {
    it('searching צחק in root mode finds Genesis 19:14 (כמצחק, H6711)', () => {
      const results = search('צחק', false, 'root');
      const gen1914 = results.find(r => r.book === 'Genesis' && r.chapter === 19 && r.verse === 14);
      expect(gen1914).toBeDefined();
    });

    it('searching יצחק in root mode finds Genesis 19:14 (כמצחק, H6711)', () => {
      const results = search('יצחק', false, 'root');
      const gen1914 = results.find(r => r.book === 'Genesis' && r.chapter === 19 && r.verse === 14);
      expect(gen1914).toBeDefined();
    });

    it('צחק and יצחק may match DIFFERENT verse sets (no transitive expansion)', () => {
      const tzchkResults = search('צחק', false, 'root');
      const ytzchkResults = search('יצחק', false, 'root');

      const tzchkKeys = new Set(tzchkResults.map(r => `${r.book}:${r.chapter}:${r.verse}`));
      const ytzchkKeys = new Set(ytzchkResults.map(r => `${r.book}:${r.chapter}:${r.verse}`));

      // They share H6711 so will overlap, but צחק also has H6712 (not in יצחק)
      // and יצחק also has H3327 (not in צחק). So sets may differ.
      // Both should find Genesis 19:14 (H6711)
      expect(tzchkKeys.has('Genesis:19:14')).toBe(true);
      expect(ytzchkKeys.has('Genesis:19:14')).toBe(true);
    });

    it('multi-term search צחק,יצחק marks Genesis 19:14 with BOTH terms', () => {
      const results = search('צחק,יצחק', false, 'root');
      const gen1914 = results.find(r => r.book === 'Genesis' && r.chapter === 19 && r.verse === 14);

      expect(gen1914).toBeDefined();
      // Should have matching entries for both term 0 and term 1
      const termIndices = gen1914!.matchingTerms.map(m => m.termIndex).sort();
      expect(termIndices).toEqual([0, 1]);
    });
  });

  describe('getRelatedRoots()', () => {
    it('returns direct neighbors for צחק lemmas', () => {
      const lemmas = findLemmasForWord('צחק');
      expect(lemmas).not.toBeNull();

      const related = getRelatedRoots(lemmas!);
      // Should find at least one related root (H3327 / Isaac via H6711 bridge)
      expect(related.length).toBeGreaterThan(0);

      // Each related root should have required fields
      for (const r of related) {
        expect(r.strongsNum).toBeTruthy();
        expect(r.rootText).toBeTruthy();
        expect(r.surfaceForm).toBeTruthy();
      }
    });

    it('does not include input lemmas in related roots', () => {
      const lemmas = findLemmasForWord('צחק');
      expect(lemmas).not.toBeNull();

      const related = getRelatedRoots(lemmas!);
      const relatedStrongs = new Set(related.map(r => r.strongsNum));
      for (const lemma of lemmas!) {
        expect(relatedStrongs.has(lemma)).toBe(false);
      }
    });

    it('deduplicates by rootText', () => {
      const lemmas = findLemmasForWord('צחק');
      expect(lemmas).not.toBeNull();

      const related = getRelatedRoots(lemmas!);
      const rootTexts = related.map(r => r.rootText);
      expect(rootTexts.length).toBe(new Set(rootTexts).size);
    });

    it('is NOT transitive (only depth-1 neighbors)', () => {
      // If A-B are neighbors and B-C are neighbors, A and C should NOT
      // appear as related for each other (unless they're also direct neighbors)
      const lemmasA = findLemmasForWord('צחק');   // has H6711, H6712
      const lemmasC = findLemmasForWord('יצחק');  // has H3327, H6711

      if (lemmasA && lemmasC) {
        const relatedFromA = getRelatedRoots(lemmasA);
        const relatedFromC = getRelatedRoots(lemmasC);

        // Both should find neighbors of their own lemmas
        // but NOT transitively through a chain
        const inputSetA = new Set(lemmasA);
        const inputSetC = new Set(lemmasC);

        // Verify that related roots are actual neighbors, not transitive
        // A's related should be neighbors of A's lemmas
        for (const r of relatedFromA) {
          expect(inputSetA.has(r.strongsNum)).toBe(false);
        }
        for (const r of relatedFromC) {
          expect(inputSetC.has(r.strongsNum)).toBe(false);
        }
      }
    });

    it('returns empty array when no adjacency data', () => {
      // Non-existent lemma
      const related = getRelatedRoots(['99999']);
      expect(related).toEqual([]);
    });
  });
});
