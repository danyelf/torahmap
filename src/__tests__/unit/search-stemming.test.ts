// Tests for Hebrew search stemming (root mode)
// These tests verify that the generated lemma data has proper roots
// Run these manually after regenerating lemma data with:
//   npx tsx scripts/generate-lemma-index.ts

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Hebrew Search Stemming Data Quality', () => {
  const strongsToRootPath = path.join(process.cwd(), 'public', 'data', 'strongs-to-root.json');
  const wordLemmasPath = path.join(process.cwd(), 'public', 'data', 'word-lemmas.json');

  // Skip if data files don't exist
  const dataExists = fs.existsSync(strongsToRootPath) && fs.existsSync(wordLemmasPath);

  it.skipIf(!dataExists)('should have roots with at least 3 characters (no single-char over-stemming)', () => {
    const strongsToRoot = JSON.parse(fs.readFileSync(strongsToRootPath, 'utf-8'));

    // Check a sample of roots to ensure none are single characters
    const sampleRoots = Object.entries(strongsToRoot).slice(0, 100);

    for (const [strongsNum, root] of sampleRoots) {
      expect(root).toBeTruthy();
      expect((root as string).length).toBeGreaterThanOrEqual(3);
    }
  });

  it.skipIf(!dataExists)('should have proper root for דבר (Strong\'s 1696-1699)', () => {
    const strongsToRoot = JSON.parse(fs.readFileSync(strongsToRootPath, 'utf-8'));

    // All דבר-related Strong's numbers should have the דבר root
    const dvarRoots = [
      strongsToRoot['1696'],
      strongsToRoot['1697'],
      strongsToRoot['1698'],
      strongsToRoot['1699'],
    ];

    dvarRoots.forEach(root => {
      expect(root).toBeTruthy();
      expect(root.length).toBeGreaterThanOrEqual(3);
      expect(root).toContain('דבר');
    });
  });

  it.skipIf(!dataExists)('should have proper root for עבד (Strong\'s 5650)', () => {
    const strongsToRoot = JSON.parse(fs.readFileSync(strongsToRootPath, 'utf-8'));
    const root = strongsToRoot['5650'];

    expect(root).toBe('עבד');
  });

  it.skipIf(!dataExists)('should include בדבר in word-lemmas (direct lookup)', () => {
    const wordLemmas = JSON.parse(fs.readFileSync(wordLemmasPath, 'utf-8'));

    // בדבר should be found directly (not require prefix stripping)
    expect(wordLemmas['בדבר']).toBeTruthy();
    expect(wordLemmas['בדבר'].length).toBeGreaterThan(0);
  });

  it.skipIf(!dataExists)('should include עבדיו in word-lemmas (with possessive suffix)', () => {
    const wordLemmas = JSON.parse(fs.readFileSync(wordLemmasPath, 'utf-8'));

    // עבדיו should be found directly (full word with suffix)
    expect(wordLemmas['עבדיו']).toBeTruthy();
    expect(wordLemmas['עבדיו'].length).toBeGreaterThan(0);
  });
});
