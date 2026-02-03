// Tests for root mode union-find clustering
// When two Strong's numbers share a surface form in word-lemmas,
// they belong to the same root cluster. Searching for any word
// that touches the cluster should match all lemmas in it.
//
// Example: צחק → [H6712, H6711], יצחק → [H3327, H6711]
// H6711 bridges them, so all three form one cluster.
// Searching either צחק or יצחק should find verses with any of [H6711, H6712, H3327].

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildSearchIndex,
  search,
  findLemmasForWord,
  loadLemmaData,
} from '../../search';
import type { VerseTexts } from '../../verseTexts';

// We need to inject lemma data for controlled testing.
// Import the internal setter (we'll add this) or mock fetch.
// For now, use the real data files if available.
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

  global.fetch = vi.fn((url: string) => {
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

describe.skipIf(!dataExists)('Root mode union-find clustering', () => {
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

  describe('צחק / יצחק clustering', () => {
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

    it('searching צחק in root mode also finds Isaac verses (H3327)', () => {
      const results = search('צחק', false, 'root');
      // Genesis 21:3 - "And Abraham called the name of his son... Isaac (יצחק)"
      // Look for any verse that has H3327 (Isaac)
      const verseLemmas = JSON.parse(fs.readFileSync(verseLemmasPath, 'utf-8'));
      const isaacVerses = Object.entries(verseLemmas)
        .filter(([, lemmas]) => (lemmas as string[]).includes('3327'))
        .map(([key]) => key);

      // At least some Isaac verses should appear in the results
      const resultKeys = new Set(results.map(r => `${r.book}:${r.chapter}:${r.verse}`));
      const overlap = isaacVerses.filter(v => resultKeys.has(v));
      expect(overlap.length).toBeGreaterThan(0);
    });

    it('צחק and יצחק match the SAME set of verses in root mode', () => {
      const tzchkResults = search('צחק', false, 'root');
      const ytzchkResults = search('יצחק', false, 'root');

      const tzchkKeys = new Set(tzchkResults.map(r => `${r.book}:${r.chapter}:${r.verse}`));
      const ytzchkKeys = new Set(ytzchkResults.map(r => `${r.book}:${r.chapter}:${r.verse}`));

      expect(tzchkKeys).toEqual(ytzchkKeys);
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

  describe('Union-find transitivity', () => {
    it('lemmas connected through shared surface forms are clustered', () => {
      // H6711 and H6712 share surface form צחק
      // H6711 and H3327 share surface form יצחק
      // So all three should be in one cluster
      const wordLemmas = JSON.parse(fs.readFileSync(wordLemmasPath, 'utf-8'));
      const tzchkLemmas = wordLemmas['צחק'];   // [6712, 6711]
      const ytzchkLemmas = wordLemmas['יצחק']; // [3327, 6711]

      // Verify the data preconditions
      expect(tzchkLemmas).toContain('6711');
      expect(tzchkLemmas).toContain('6712');
      expect(ytzchkLemmas).toContain('3327');
      expect(ytzchkLemmas).toContain('6711');

      // H6711 bridges the two surface forms, creating one cluster
      // Both searches should use all three lemmas
      const resultsA = search('צחק', false, 'root');
      const resultsB = search('יצחק', false, 'root');

      // Same verse set
      const keysA = new Set(resultsA.map(r => `${r.book}:${r.chapter}:${r.verse}`));
      const keysB = new Set(resultsB.map(r => `${r.book}:${r.chapter}:${r.verse}`));
      expect(keysA).toEqual(keysB);
    });
  });
});
