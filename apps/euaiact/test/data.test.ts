import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ActGroup, ActRef, ActStructure, ActTexts } from '../src/data.ts';
import { ownerOf } from '../src/ids.ts';

const shipped = <T>(file: string): T =>
  JSON.parse(readFileSync(`public/data/euaiact/${file}`, 'utf8'));
const structure = shipped<ActStructure>('structure.json');
const texts = shipped<ActTexts>('texts.json');
const refs = shipped<ActRef[]>('refs.json');

const cellIds = (g: ActGroup) =>
  g.kind === 'plain' ? [g.cell.id] : [...(g.lead ? [g.lead.id] : []), ...g.points.map((p) => p.id)];
const blocks = [
  ...structure.chapters.flatMap((c) => c.columns.flatMap((col) => col.runs.flat())),
  ...structure.annexes.flatMap((a) => a.blocks),
];
const ids = [
  ...Array.from({ length: structure.recitals }, (_, i) => `Recital.${i + 1}`),
  ...blocks.flatMap((b) => b.groups.flatMap(cellIds)),
];

describe('the shipped Act', () => {
  it('has no two squares with one id', () => {
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has text for every square and none for anything else', () => {
    expect(Object.keys(texts).sort()).toEqual([...ids].sort());
  });

  // A reference names a square, a paragraph or point that holds squares ("6(2)" for a list with
  // no lead-in sentence of its own), a whole article, or a whole annex.
  it('has only references whose ends are in the map', () => {
    const owners = new Set(ids.map(ownerOf));
    const exact = new Set(ids);
    const resolves = (unit: string) =>
      owners.has(unit) || exact.has(unit) || ids.some((id) => id.startsWith(`${unit}(`));
    expect(refs.filter(([from, to]) => !resolves(from) || !resolves(to))).toEqual([]);
  });
});
