import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { MAP_BACKGROUND } from '@torahmap/engine';
import { rgbToHsl } from '@torahmap/utils';
import { ENGLISH, HEBREW } from '@torahmap/shell/language.ts';
import type { TalmudStructure } from '../src/data.ts';
import { DATING_FILE, type TalmudDating } from '../src/dating.ts';
import { talmudId } from '../src/layout.ts';
import {
  datingOverlay,
  generationColor,
  generationLabel,
  uncertainColor,
  yearsOf,
  yearsShort,
} from '../src/overlays/dating.ts';

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
    'A.2a.1': [0, 0, [0], [0, 3, 0]],
    'A.2a.2': [2, 0, [1], [4, 7, 1]],
    'A.2a.3': [1, 1, [2], [4, 7, 2]],
    'A.2a.4': [2, 0, [0, 1], []],
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

  it('keeps each era in a range of hues of its own', () => {
    const hues = (codes: string[]) => codes.map((c) => rgbToHsl(generationColor(c)).h);
    const eras = [
      hues(['Z1', 'Z2', 'Z3', 'Z4', 'Z5']),
      hues(['T1', 'T2', 'T3', 'T4', 'T5', 'T6']),
      hues(['TA']),
      hues(['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8']),
    ].map((h) => [Math.min(...h), Math.max(...h)]);
    for (const [i, [lo, hi]] of eras.entries()) {
      for (const [otherLo, otherHi] of eras.slice(i + 1)) {
        expect(hi < otherLo || otherHi < lo).toBe(true);
      }
    }
  });

  it('makes an uncertain segment a paler version of its generation’s colour', () => {
    expect(colour('A.2a.3')).toEqual(uncertainColor(generationColor('A2')));
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

  it('groups its key by era, with no generation codes', () => {
    const box = document.createElement('div');
    overlay.renderLegend?.(box, undefined as never, { dating });
    const headings = [...box.querySelectorAll('.legend-heading')].map((e) => e.textContent);
    expect(headings).toEqual(['Tannaim', 'Amoraim']);
    expect(box.textContent).not.toMatch(/\b(?:[ZTA]\d|TA)\b/);
  });

  it('gives generations in one band the same swatch in the key', () => {
    const generations = [
      { code: 'A1', name: '', from: 220, to: 250 },
      { code: 'A2', name: '', from: 250, to: 290 },
      { code: 'A6', name: '', from: 375, to: 425 },
    ];
    const box = document.createElement('div');
    overlay.renderLegend?.(box, undefined as never, { dating: { ...dating, generations } });
    const [a1, a2, a6] = [...box.querySelectorAll<HTMLElement>('.swatch')].map(
      (e) => e.style.background,
    );
    expect(a1).toBe(a2);
    expect(a1).not.toBe(a6);
  });

  it('lists the rabbis in one line, in both languages, with the one that dates the passage in bold', () => {
    const box = overlay.renderSidebarInfo?.(item('A.2a.4'), true, undefined as never, { dating });
    expect(box?.children).toHaveLength(2);
    expect([...(box?.querySelectorAll('[lang="he"]') ?? [])].map((e) => e.textContent)).toEqual([
      dating.people[0].he,
      dating.people[1].he,
    ]);
    expect(box?.querySelector('strong')?.textContent).toContain(dating.people[1].en);
    expect(box?.textContent).toContain(
      `(${generationLabel('A4', true)}, ${yearsShort(dating.generations[2])})`,
    );
    expect(box?.textContent).not.toContain('A4');
    expect(box?.querySelector('div')).toBeNull();
  });

  it('marks an ambiguous name’s generation as a guess', () => {
    const box = overlay.renderSidebarInfo?.(item('A.2a.3'), true, undefined as never, { dating });
    expect(box?.textContent).toContain(`(${generationLabel('A2', true)}?,`);
  });

  it('marks each rabbi’s name in the Hebrew, paler where the name is ambiguous', () => {
    const marked = (id: string) =>
      overlay.highlightItemText?.(item(id), 'אמר רבא', HEBREW, undefined as never, { dating });
    const mark = (id: string) => marked(id)?.querySelector<HTMLElement>('mark');
    expect(mark('A.2a.2')?.textContent).toBe('רבא');
    expect(marked('A.2a.2')?.textContent).toBe('אמר רבא');
    expect(mark('A.2a.2')?.style.background).not.toBe(mark('A.2a.3')?.style.background);
  });

  it('marks nothing in the English or in a segment that names no rabbi', () => {
    const text = (id: string, language: typeof HEBREW | typeof ENGLISH) =>
      overlay.highlightItemText?.(item(id), 'אמר רבא', language, undefined as never, { dating });
    expect(text('A.2a.2', ENGLISH)?.querySelector('mark')).toBeNull();
    expect(text('A.2a.9', HEBREW)?.querySelector('mark')).toBeNull();
  });

  it('adds nothing to the panel of a segment that is not pinned or names no rabbi', () => {
    const lines = (id: string, pinned: boolean) =>
      overlay.renderSidebarInfo?.(item(id), pinned, undefined as never, { dating });
    expect(lines('A.2a.1', false)).toBeNull();
    expect(lines('A.2a.9', true)).toBeNull();
  });
});

describe('generationLabel', () => {
  it('names each era’s generations in words, with no code', () => {
    const labels = ['Z3', 'T5', 'TA', 'A4'].flatMap((c) => [
      generationLabel(c),
      generationLabel(c, true),
    ]);
    for (const label of labels) expect(label).not.toMatch(/\b[ZTA]\d?\b/);
    expect(generationLabel('T5')).toContain('Tanna');
    expect(generationLabel('A4')).toContain('Amora');
    expect(generationLabel('Z3')).toContain('Zugot');
  });

  it('gives every generation its own label', () => {
    const codes = [
      'Z1',
      'Z2',
      'Z3',
      'Z4',
      'Z5',
      'T1',
      'T2',
      'T3',
      'T4',
      'T5',
      'T6',
      'TA',
      'A1',
      'A2',
      'A3',
      'A4',
      'A5',
      'A6',
      'A7',
      'A8',
    ];
    expect(new Set(codes.map((c) => generationLabel(c))).size).toBe(codes.length);
    expect(new Set(codes.map((c) => generationLabel(c, true))).size).toBe(codes.length);
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
    for (const [generation, , people, spans] of Object.values(shipped.segments)) {
      expect(shipped.generations[generation]).toBeDefined();
      for (const p of people) expect(shipped.people[p]).toBeDefined();
      for (let i = 0; i < spans.length; i += 3) {
        expect(spans[i]).toBeLessThan(spans[i + 1]);
        expect(people).toContain(spans[i + 2]);
      }
    }
    for (const person of shipped.people) expect(shipped.generations[person.gen]).toBeDefined();
  });
});
