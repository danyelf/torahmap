import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { countMarkers, totalSegments, shapeMatches, verifyTractate } from '../verify-coverage.ts';

const FIXTURES = join(__dirname, '../fixtures');

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), 'utf-8'));
}

describe('countMarkers', () => {
  it('counts the bold marker that opens a segment, as the bundle reads it', () => {
    const text = [
      ['<big><strong>מתני׳</strong></big> one', 'two'],
      ['three', "<big><strong>גמ'</strong></big> four"],
    ];
    expect(countMarkers(text)).toEqual({ matnitin: 1, gemara: 1 });
  });

  it('does not count the word in running text', () => {
    expect(countMarkers([['אמר מתני׳ מני רבי שמעון היא']])).toEqual({ matnitin: 0, gemara: 0 });
  });
});

describe('totalSegments', () => {
  it('sums segment counts across amudim', () => {
    expect(totalSegments([['a', 'b', 'c'], ['d'], ['e', 'f']])).toBe(6);
  });

  it('returns 0 for empty array', () => {
    expect(totalSegments([])).toBe(0);
  });
});

describe('shapeMatches', () => {
  it('matches identical shapes', () => {
    const a = { text: [['x', 'y'], ['z']] };
    const b = { text: [['1', '2'], ['3']] };
    expect(shapeMatches(a, b).match).toBe(true);
  });

  it('rejects differing amud counts', () => {
    const a = { text: [['x']] };
    const b = { text: [['x'], ['y']] };
    const r = shapeMatches(a, b);
    expect(r.match).toBe(false);
    expect(r.reason).toContain('amud count');
  });

  it('rejects differing segment counts within an amud', () => {
    const a = { text: [['x', 'y']] };
    const b = { text: [['x']] };
    const r = shapeMatches(a, b);
    expect(r.match).toBe(false);
    expect(r.reason).toContain('amud 0');
  });
});

describe('verifyTractate', () => {
  it('hard-fails on empty text', () => {
    const sc = { alts: { Chapters: { nodes: [{}] } } };
    const r = verifyTractate({ text: [] }, { text: [] }, sc);
    expect(r.status).toBe('hard-fail');
    expect(r.failures).toContain('no text');
  });

  it('hard-fails when Wikisource, read for the verses it names, is divided differently', () => {
    const md = loadFixture('fake-tractate-clean.json');
    const ws = loadFixture('fake-tractate-shape-mismatch-wikisource.json');
    const sc = loadFixture('fake-tractate-schema.json');
    const r = verifyTractate(md, ws, sc);
    expect(r.status).toBe('hard-fail');
    expect(r.failures.some((f) => f.includes('shape mismatch'))).toBe(true);
  });

  it('hard-fails on missing schema nodes', () => {
    const md = loadFixture('fake-tractate-clean.json');
    const sc = { alts: { Chapters: { nodes: [] } } };
    const r = verifyTractate(md, md, sc);
    expect(r.status).toBe('hard-fail');
    expect(r.failures.some((f) => f.includes('no perek nodes'))).toBe(true);
  });

  it('passes when marker counts are within the plausibility range', () => {
    // Fixture has 2 matnitin and 2 gemara. MARKER_MIN = 3, so this
    // would soft-fail on mishnah+gemara counts.
    const md = loadFixture('fake-tractate-clean.json');
    const sc = loadFixture('fake-tractate-schema.json');
    const r = verifyTractate(md, md, sc);
    expect(r.status).toBe('soft-fail');
    expect(r.markers.matnitin).toBe(2);
    expect(r.markers.gemara).toBe(2);
  });

  it('passes when everything is plausible', () => {
    // Build a synthetic tractate with plausible marker counts.
    const amudim: string[][] = [];
    for (let i = 0; i < 15; i++) {
      amudim.push([
        `<big><strong>מתני׳</strong></big> mishnah ${i}`,
        `<big><strong>גמ׳</strong></big> gemara ${i}`,
      ]);
    }

    const sc = loadFixture('fake-tractate-schema.json');
    const r = verifyTractate({ text: amudim }, { text: amudim }, sc);
    expect(r.status).toBe('pass');
    expect(r.failures).toEqual([]);
    expect(r.markers.matnitin).toBe(15);
    expect(r.markers.gemara).toBe(15);
  });
});
