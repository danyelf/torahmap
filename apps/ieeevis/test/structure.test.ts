// The shipped program is valid: it fails only when the data is wrong.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CITED_FILE,
  papersOf,
  STRUCTURE_FILE,
  type CitedWork,
  type Structure,
} from '../src/data.ts';
import { pieceId } from '../src/layout.ts';
import { SECTIONS } from '../src/overlays/sections.ts';

const structure = JSON.parse(readFileSync(`public/data/${STRUCTURE_FILE}`, 'utf8')) as Structure;

describe('the shipped program', () => {
  const papers = papersOf(structure);

  it('names every piece by a section the map knows, or x for no text', () => {
    const known = new Set([...Object.keys(SECTIONS), 'x']);
    for (const paper of papers) {
      expect(paper.pieces.length).toBeGreaterThan(0);
      for (const letter of paper.pieces) expect(known.has(letter), paper.title).toBe(true);
    }
  });

  it('lists as citing only papers it holds, each once per work', () => {
    const cited = JSON.parse(readFileSync(`public/data/${CITED_FILE}`, 'utf8')) as CitedWork[];
    const indexes = new Set(papers.map((p) => p.index));
    const lengths = new Map(papers.map((p) => [p.index, p.pieces.length]));
    for (const work of cited) {
      expect(new Set(work.papers).size).toBe(work.papers.length);
      expect(work.pieces.length, work.title).toBe(work.papers.length);
      for (const paper of work.papers) expect(indexes.has(paper), work.title).toBe(true);
      work.papers.forEach((paper, i) => {
        for (const piece of work.pieces[i])
          expect(piece, work.title).toBeLessThan(lengths.get(paper)!);
      });
    }
  });

  it('gives no two papers one index, so no two squares share an id', () => {
    const ids = papers.flatMap((p) => [...p.pieces].map((_, n) => pieceId(p.index, n)));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
