import { describe, it, expect } from 'vitest';
import { computeTalmudLayout, type TalmudLayoutItem } from '../src/layout.ts';
import { mishnahMarks, onScreen } from '../src/mishnahMarks.ts';
import { mishnahOrGemaraColor } from '../src/baseColor.ts';
import { GEMARA_BASE_COLOR, MISHNAH_BASE_COLOR } from '../src/constants.ts';
import { talmudFixture as fixture } from './helpers/talmudFixture.ts';

const square = (tractate: string, segment: number, round: boolean): TalmudLayoutItem =>
  ({ tractate, daf: 2, amud: 'a', segment, id: `${tractate}.${segment}`, round }) as never;
const letters = (items: TalmudLayoutItem[]) =>
  mishnahMarks(items).map(({ item, letter }) => `${item.id} ${letter}`);

describe('mishnahMarks', () => {
  it('puts מ on the first square of a Mishnah and ג on the first Gemara square after it', () => {
    const items = [true, true, false, false, true, false].map((r, i) => square('T', i + 1, r));
    expect(letters(items)).toEqual(['T.1 מ', 'T.3 ג', 'T.5 מ', 'T.6 ג']);
  });

  it('marks nothing where there is no Mishnah', () => {
    expect(letters([false, false].map((r, i) => square('T', i + 1, r)))).toEqual([]);
  });

  it('gives a Mishnah that ends a tractate no ג, and starts afresh in the next', () => {
    const items = [square('T', 1, true), square('U', 1, true), square('U', 2, false)];
    expect(letters(items)).toEqual(['T.1 מ', 'U.1 מ', 'U.2 ג']);
  });

  it('reads the laid-out map: a Mishnah square is a round one, and TractA has two Mishnayot', () => {
    const { items } = computeTalmudLayout(fixture);
    const marks = mishnahMarks(items.filter((i) => i.tractate === 'TractA'));
    expect(marks.map((m) => `${m.item.daf}${m.item.amud}:${m.item.segment} ${m.letter}`)).toEqual([
      '2a:1 מ',
      '2a:2 ג',
      '3b:1 מ',
      '3b:2 ג',
    ]);
  });
});

describe('the Mishnah’s colour', () => {
  const mishnah = { tractate: 'TractA', daf: 2, amud: 'a' as const, segment: 1 };
  /** The colour's channels over a base colour's: equal when only the brightness was jittered. */
  const hueOf = (color: readonly number[], base: readonly number[]) =>
    color.map((c, i) => c / base[i]);

  it('is violet with no tool', () => {
    const [r, g, b] = hueOf(mishnahOrGemaraColor(fixture, mishnah), MISHNAH_BASE_COLOR);
    expect(g).toBeCloseTo(r, 5);
    expect(b).toBeCloseTo(r, 5);
  });

  it('is the Gemara’s colour under a tool', () => {
    const [r, g, b] = hueOf(mishnahOrGemaraColor(fixture, mishnah, true), GEMARA_BASE_COLOR);
    expect(g).toBeCloseTo(r, 5);
    expect(b).toBeCloseTo(r, 5);
  });
});

describe('onScreen', () => {
  // At zoom 2 with the map panned by (-100, -50), a 400 × 300 screen shows map x 100–300, y 50–200.
  const view = onScreen({ x: -100, y: -50 }, 2, 400, 300, 5);

  it('takes in a square on the screen', () => {
    expect(view(150, 100)).toBe(true);
  });

  it('takes in a square only partly on the screen', () => {
    expect(view(97, 48)).toBe(true);
    expect(view(299, 199)).toBe(true);
  });

  it('leaves out a square off each side', () => {
    expect(view(94, 100)).toBe(false);
    expect(view(301, 100)).toBe(false);
    expect(view(150, 44)).toBe(false);
    expect(view(150, 201)).toBe(false);
  });
});
