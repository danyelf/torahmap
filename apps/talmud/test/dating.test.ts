import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { MAP_BACKGROUND } from '@torahmap/engine';
import type { TalmudStructure } from '../src/data.ts';
import { DATING_FILE, type TalmudDating } from '../src/dating.ts';
import { talmudId } from '../src/layout.ts';
import { datingOverlay, generationColor, paleColor, yearsOf } from '../src/overlays/dating.ts';

const dating: TalmudDating = {
  generations: [
    { code: 'T5', name: 'Tannaim, 5th generation', from: 135, to: 170 },
    { code: 'A2', name: 'Amoraim, 2nd generation', from: 250, to: 290 },
    { code: 'A4', name: 'Amoraim, 4th generation', from: 320, to: 350 },
  ],
  people: [
    { en: 'Rabbi Meir', he: 'רבי מאיר', gen: 0 },
    { en: 'Rava', he: 'רבא', gen: 2 },
    { en: 'Rabbi Elazar', he: 'ר"א', gen: 1, ambiguous: true },
  ],
  segments: {
    'A.2a.1': [0, 0, 0],
    'A.2a.2': [2, 0, 1],
    'A.2a.3': [1, 1, 2],
  },
};

const item = (id: string) => ({ id, x: 0, y: 0, size: 6 }) as never;
const base = () => [0.6, 0.5, 0.4] as [number, number, number];
const overlay = datingOverlay(base);
const colour = (id: string) =>
  overlay.getItemColor(item(id), undefined as never, { dating }) as number[];

describe('the dating overlay', () => {
  it('gives each generation its own colour', () => {
    const colours = ['A.2a.1', 'A.2a.2'].map(colour);
    expect(colours[0]).not.toEqual(colours[1]);
    expect(colours[0]).toEqual(generationColor('T5'));
  });

  it('makes an uncertain segment a paler version of its generation’s colour', () => {
    expect(colour('A.2a.3')).toEqual(paleColor(generationColor('A2')));
    expect(colour('A.2a.3')).not.toEqual(generationColor('A2'));
  });

  it('tints a segment that names no rabbi faintly with its usual colour', () => {
    const [r, g, b] = colour('A.2a.9');
    expect(r).toBeGreaterThan(MAP_BACKGROUND[0]);
    expect(r).toBeLessThan(base()[0]);
    expect(g).toBeLessThan(base()[1]);
    expect(b).toBeLessThan(base()[2]);
  });

  it('colours many segments as it colours one', () => {
    const ids = ['A.2a.1', 'A.2a.3', 'A.2a.9'];
    expect(overlay.colorsFor(ids.map(item), undefined as never, null, { dating })).toEqual(
      ids.map(colour),
    );
  });

  it('gives its key one row for each generation that occurs, and two more', () => {
    const box = document.createElement('div');
    overlay.renderLegend?.(box, undefined as never, { dating });
    const swatches = [...box.querySelectorAll<HTMLElement>('.swatch')].map(
      (e) => e.style.background,
    );
    expect(swatches).toHaveLength(dating.generations.length + 2);
    expect(new Set(swatches).size).toBe(swatches.length);
  });

  it('lists each rabbi in the pinned panel with its names in both languages', () => {
    const box = overlay.renderSidebarInfo?.(item('A.2a.2'), true, undefined as never, { dating });
    expect(box?.children).toHaveLength(2);
    const hebrew = box?.querySelector<HTMLElement>('[lang="he"]');
    expect(hebrew?.textContent).toBe(dating.people[1].he);
    expect(box?.children[1].textContent).toContain(dating.people[1].en);
  });

  it('words an ambiguous name’s line differently from a settled one', () => {
    const line = (id: string) =>
      overlay.renderSidebarInfo?.(item(id), true, undefined as never, { dating })?.children[1]
        .textContent;
    const settled = line('A.2a.2')!
      .replace(dating.people[1].en, '')
      .replace(dating.people[1].he, '');
    const ambiguous = line('A.2a.3')!
      .replace(dating.people[2].en, '')
      .replace(dating.people[2].he, '');
    expect(ambiguous).not.toEqual(
      settled.replace(dating.generations[2].name, dating.generations[1].name),
    );
  });

  it('adds nothing to the panel of a segment that is not pinned or names no rabbi', () => {
    const lines = (id: string, pinned: boolean) =>
      overlay.renderSidebarInfo?.(item(id), pinned, undefined as never, { dating });
    expect(lines('A.2a.1', false)).toBeNull();
    expect(lines('A.2a.9', true)).toBeNull();
  });
});

describe('yearsOf', () => {
  it('writes the era once when both ends share it', () => {
    expect(yearsOf({ code: 'Z3', name: '', from: -100, to: -60 })).toBe('c. 100–60 BCE');
    expect(yearsOf({ code: 'A4', name: '', from: 320, to: 350 })).toBe('c. 320–350 CE');
    expect(yearsOf({ code: 'Z5', name: '', from: -30, to: 20 })).toBe('c. 30 BCE–20 CE');
  });
});

describe('the shipped dating file', () => {
  const shipped = JSON.parse(readFileSync(`public/data/${DATING_FILE}`, 'utf-8')) as TalmudDating;
  const structure = JSON.parse(
    readFileSync('public/data/talmud/structure.json', 'utf-8'),
  ) as TalmudStructure;

  it('dates only segments that are on the map', () => {
    const onMap = new Set(
      structure.tractates.flatMap((t) =>
        t.amudim.flatMap((a) =>
          Array.from({ length: a.segmentCount }, (_, i) =>
            talmudId({ tractate: t.name, daf: a.daf, amud: a.amud, segment: i + 1 }),
          ),
        ),
      ),
    );
    expect(Object.keys(shipped.segments).filter((id) => !onMap.has(id))).toEqual([]);
  });

  it('points every segment at a generation and every rabbi it lists', () => {
    for (const [generation, , ...people] of Object.values(shipped.segments)) {
      expect(shipped.generations[generation]).toBeDefined();
      for (const p of people) expect(shipped.people[p]).toBeDefined();
    }
    for (const person of shipped.people) expect(shipped.generations[person.gen]).toBeDefined();
  });
});
