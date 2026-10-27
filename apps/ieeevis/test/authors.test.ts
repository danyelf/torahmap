import { describe, it, expect } from 'vitest';
import { pickColors } from '@torahmap/shell/overlays/picks.ts';
import type { Structure } from '../src/data.ts';
import type { PieceItem } from '../src/layout.ts';
import { authorsOverlay } from '../src/overlays/authors.ts';
import { suggest } from '../src/overlays/authorPicks.ts';

const paper = (index: number, authors: string[], pieces = 'ai') => ({
  index,
  title: `Paper ${index}`,
  authors,
  kind: 'Full VIS Paper',
  when: '',
  pieces,
});

const structure: Structure = {
  days: [
    {
      name: 'Mon',
      sessions: [
        {
          name: 'S',
          start: '',
          papers: [
            paper(0, ['Ana Silva', 'Bei Wang']),
            paper(1, ['Bei Wang']),
            paper(2, ['José Núñez'], 'x'),
          ],
        },
      ],
    },
  ],
};
const data = { structure };

const squares = (...papers: number[]) =>
  papers.map((i) => {
    const p = structure.days[0].sessions[0].papers[i];
    return { id: `${i}.0`, paper: p, section: p.pieces[0] } as unknown as PieceItem;
  });
const colours = (picked: string[], ...papers: number[]) =>
  authorsOverlay.colorsFor(squares(...papers) as never, { picked }, null, data);

describe('the authors overlay', () => {
  it('lights an author’s papers and dims the rest', () => {
    const [mine, other] = colours(['Bei Wang'], 1, 2);
    expect(mine).toEqual(pickColors(1)[0]);
    expect(other).not.toEqual(mine);
  });

  it('splits a paper by two picked authors between their colours', () => {
    const [both] = colours(['Ana Silva', 'Bei Wang'], 0);
    expect(both).toEqual(pickColors(2));
  });

  it('stands out only the picked authors’ papers', () => {
    expect(
      authorsOverlay.standoutsFor!(squares(0, 1, 2) as never, { picked: ['Ana Silva'] }, data),
    ).toEqual([true, false, false]);
  });

  it('ignores an author the program does not hold', () => {
    const [plain] = colours([], 2);
    expect(colours(['Nobody'], 2)[0]).toEqual(plain);
  });

  it('comes back from a link as the same picks', () => {
    const settings = { picked: ['Ana Silva', 'Bei Wang'] };
    expect(authorsOverlay.settingsFromUrl!(authorsOverlay.settingsToUrl!(settings))).toEqual(
      settings,
    );
    expect(authorsOverlay.settingsToUrl!({ picked: [] })).toEqual({});
  });
});

describe('finding an author', () => {
  it('matches any word of the name, without accents', () => {
    expect(suggest(data, 'nunez').map((a) => a.name)).toEqual(['José Núñez']);
    expect(suggest(data, 'wang bei').map((a) => a.name)).toEqual(['Bei Wang']);
  });

  it('puts names starting with the typing first, then the most papers', () => {
    const names = suggest(data, 'a').map((a) => a.name);
    expect(names[0]).toBe('Ana Silva');
  });

  it('leaves out authors already picked', () => {
    const [bei] = suggest(data, 'bei');
    expect(suggest(data, 'bei', [bei])).toEqual([]);
  });
});
