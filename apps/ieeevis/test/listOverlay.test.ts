import { describe, it, expect } from 'vitest';
import { pickColors } from '@torahmap/shell/overlays/picks.ts';
import type { Structure } from '../src/data.ts';
import type { PieceItem } from '../src/layout.ts';
import { authorsOverlay } from '../src/overlays/authors.ts';
import { keywordsOverlay } from '../src/overlays/keywords.ts';
import { picksOf } from '../src/overlays/listPicks.ts';

const paper = (index: number, authors: string[], pieces = 'ai', keywords?: string[]) => ({
  ...(keywords ? { keywords } : {}),
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
            paper(0, ['Ana Silva', 'Bei Wang'], 'ai', ['Visual analytics', 'Uncertainty']),
            paper(1, ['Bei Wang'], 'ai', ['Visual analytics']),
            paper(2, ['José Núñez'], 'x'),
          ],
        },
      ],
    },
  ],
};
const data = { structure };
const { suggest } = picksOf({ namesOf: (p) => p.authors });

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
    expect(mine).toEqual(pickColors([0])[0]);
    expect(other).not.toEqual(mine);
  });

  it('splits a paper by two picked authors between their colours', () => {
    const [both] = colours(['Ana Silva', 'Bei Wang'], 0);
    expect(both).toEqual(pickColors([0, 1]));
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
    expect(authorsOverlay.settingsFromUrl!(authorsOverlay.settingsToUrl!(settings), [])).toEqual(
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

describe('the keywords overlay', () => {
  const colourOf = (picked: string[], ...papers: number[]) =>
    keywordsOverlay.colorsFor(squares(...papers) as never, { picked }, null, data);

  it('lights the papers that list a keyword, and dims the ones that list none', () => {
    const [listed, none] = colourOf(['Visual analytics'], 1, 2);
    expect(listed).toEqual(pickColors([0])[0]);
    expect(none).not.toEqual(listed);
  });

  it('splits a paper listing two picked keywords between their colours', () => {
    expect(colourOf(['Visual analytics', 'Uncertainty'], 0)[0]).toEqual(pickColors([0, 1]));
  });

  it('says how many papers list keywords', () => {
    const container = document.createElement('div');
    keywordsOverlay.renderLegend!(container, { picked: [] }, data);
    expect(container.textContent).toContain('2 of 3 papers list keywords');
  });
});

describe('the quick picks', () => {
  const open = (settings: { picked: string[] }) => {
    const container = document.createElement('div');
    const changes: { picked: string[] }[] = [];
    keywordsOverlay.renderControls!(
      container,
      settings,
      (update) => changes.push(update(settings, [])),
      data,
    );
    const chips = [...container.querySelectorAll<HTMLButtonElement>('.pick-chip')];
    return { chips, changes };
  };

  it('are shown in Title Case, and pick the keyword as written', () => {
    const { chips, changes } = open({ picked: [] });
    const chip = chips.find((c) => c.textContent === 'Visual Analytics')!;
    chip.click();
    expect(changes).toEqual([{ picked: ['Visual analytics'] }]);
  });

  it('unpick a keyword when clicked again', () => {
    const { chips, changes } = open({ picked: ['Visual analytics'] });
    const chip = chips.find((c) => c.textContent === 'Visual Analytics')!;
    expect(chip.disabled).toBe(false);
    chip.click();
    expect(changes).toEqual([{ picked: [] }]);
  });
});
