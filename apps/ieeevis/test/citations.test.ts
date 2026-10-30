import { describe, it, expect } from 'vitest';
import { pickColors } from '@torahmap/shell/overlays/picks.ts';
import {
  entriesOf,
  peopleAt,
  peopleByPaper,
  workId,
  worksAt,
  worksByPaper,
  type CitedData,
} from '../src/citations.ts';
import type { CitedWork, Structure } from '../src/data.ts';
import type { PieceItem } from '../src/layout.ts';
import { citationsOverlay } from '../src/overlays/citations.ts';
import { citedPeopleOverlay } from '../src/overlays/citedPeople.ts';
import { citedWorksOverlay } from '../src/overlays/citedWorks.ts';

const paper = (index: number) => ({
  index,
  title: `Paper ${index}`,
  page: `https://ieeevis.org/year/2026/paper/${index}`,
  authors: [],
  kind: 'Full VIS Paper',
  when: '',
  pieces: 'afff',
});
const structure: Structure = {
  days: [{ name: 'Mon', sessions: [{ name: 'S', start: '', papers: [0, 1, 2, 3].map(paper) }] }],
};
/** A work, cited by `papers`, found in piece 1 of each unless `pieces` says where. */
const work = (
  title: string,
  authors: string[],
  papers: number[],
  year: number | null = 2020,
  pieces: number[][] = papers.map(() => [1]),
) => ({ title, year, authors, papers, pieces }) satisfies CitedWork;
const cited = [
  work('Vega-Lite', ['Arvind Satyanarayan', 'Jeffrey Heer'], [0, 1, 2]),
  work('Visualization Analysis and Design', ['Tamara Munzner'], [0, 1]),
  work('Interactive dynamics', ['Jeffrey Heer'], [1], 2020, [[2]]),
  work('Anonymous note', ['Ana Silva'], [0], null, [[]]),
];
const data: CitedData = { structure, cited };

const square = (paperIndex: number, piece = 1) =>
  ({
    id: `${paperIndex}.${piece}`,
    paper: structure.days[0].sessions[0].papers[paperIndex],
    piece,
    section: 'f',
  }) as unknown as PieceItem;

describe('what each paper cites', () => {
  it('names the people of every work a paper cites, once', () => {
    expect(peopleByPaper(data).get(1)?.sort()).toEqual([
      'Arvind Satyanarayan',
      'Jeffrey Heer',
      'Tamara Munzner',
    ]);
  });

  it('gives a paper that cites nothing no entry', () => {
    expect(peopleByPaper(data).has(3)).toBe(false);
    expect(worksByPaper(data).has(3)).toBe(false);
  });

  it('names the people and works whose entries a square holds', () => {
    expect(peopleAt(data).get('1.1')?.sort()).toEqual([
      'Arvind Satyanarayan',
      'Jeffrey Heer',
      'Tamara Munzner',
    ]);
    expect(peopleAt(data).get('1.2')).toEqual(['Jeffrey Heer']);
    expect(worksAt(data).get('1.2')).toEqual([workId(2)]);
    expect(peopleAt(data).has('1.0')).toBe(false);
  });

  it('puts a work on the reference squares of a paper whose text it was not found in', () => {
    expect(worksAt(data).has('0.0')).toBe(false);
    expect(worksAt(data).get('0.3')).toEqual([workId(3)]);
  });
});

describe('the cited people overlay', () => {
  const colours = (picked: string[], ...squares: PieceItem[]) =>
    citedPeopleOverlay.colorsFor(squares as never, { picked }, null, data);

  it('lights the squares that hold a person’s works and dims the rest of the paper', () => {
    const [holds, otherPiece, otherPaper] = colours(
      ['Tamara Munzner'],
      square(0, 1),
      square(0, 2),
      square(2, 1),
    );
    expect(holds).toEqual(pickColors([0])[0]);
    expect(otherPiece).not.toEqual(holds);
    expect(otherPaper).not.toEqual(holds);
  });

  it('stands out only those squares', () => {
    expect(
      citedPeopleOverlay.standoutsFor!(
        [square(1, 1), square(1, 2), square(1, 0)] as never,
        { picked: ['Jeffrey Heer'] },
        data,
      ),
    ).toEqual([true, true, false]);
  });

  it('says in the popup which picked people the square cites', () => {
    const info = (piece: number) =>
      citedPeopleOverlay.getHoverInfo!(square(1, piece), { picked: ['Jeffrey Heer'] }, data);
    expect(info(1)).toBe('cites: Jeffrey Heer');
    expect(info(0)).toBeNull();
  });
});

describe('the cited works overlay', () => {
  it('lights the squares that hold a work, picked by its id', () => {
    const [holds, other] = citedWorksOverlay.colorsFor(
      [square(2, 1), square(3, 1)] as never,
      { picked: [workId(0)] },
      null,
      data,
    );
    expect(holds).toEqual(pickColors([0])[0]);
    expect(other).not.toEqual(holds);
  });

  it('finds a work by its title or its authors', () => {
    const open = (typed: string) => {
      const container = document.createElement('div');
      citedWorksOverlay.renderControls!(container, { picked: [] }, () => {}, data);
      const input = container.querySelector<HTMLInputElement>('.pick-input')!;
      input.value = typed;
      input.dispatchEvent(new Event('input'));
      return [...container.querySelectorAll('.pick-suggestions .pick-row')].map(
        (r) => r.textContent,
      );
    };
    expect(open('vega')[0]).toContain('Vega-Lite (2020)');
    expect(open('munzner')[0]).toContain('Visualization Analysis and Design');
  });
});

describe('the entries of cited works in a text', () => {
  const text = [
    'pp. 1–10. External Links: Document',
    '[2] A. Satyanarayan and J. Heer (2014) Lyra: an interactive visualization design environment. CGF.',
    '[3] A. Satyanarayan, D. Moritz (2017) Vega-Lite: A grammar of interactive graphics. TVCG 23.',
    '[4] Someone Else (2020) Another title.',
  ].join('\n');
  const marked = (titles: string[]) =>
    entriesOf(text, titles).map(({ start, end }) => text.slice(start, end));

  it('takes the whole entry the title is in, however the title is cased or punctuated', () => {
    expect(marked(['Vega-lite: a grammar of interactive graphics'])).toEqual([
      '[3] A. Satyanarayan, D. Moritz (2017) Vega-Lite: A grammar of interactive graphics. TVCG 23.',
    ]);
  });

  it('takes an entry running on from the piece before, from the start of its line', () => {
    expect(marked(['External Links Document'])).toEqual(['pp. 1–10. External Links: Document']);
  });

  it('takes entries run together on one line, each from its number', () => {
    const run = '[7] First (2001) One title. Venue. [8] Second (2002) Two title. Venue.';
    const [entry] = entriesOf(run, ['Two title']);
    expect(run.slice(entry.start, entry.end)).toBe('[8] Second (2002) Two title. Venue.');
  });

  it('takes one entry of a list without numbers, from its author to its end', () => {
    const run =
      'Able, Ann, and Bo C. Baker et al. 2019. “First title.” Venue One, 1–12. https://doi.org/10.1/1. ' +
      'Cole, Cy, and Di Dunn. 2020a. Second title: with a subtitle. Venue Two, 3(4). Eve, Ed. 2021. Third title.';
    const [entry] = entriesOf(run, ['Second title with a subtitle']);
    expect(run.slice(entry.start, entry.end)).toBe(
      'Cole, Cy, and Di Dunn. 2020a. Second title: with a subtitle. Venue Two, 3(4).',
    );
  });

  it('matches whole words only', () => {
    expect(marked(['Another titl'])).toEqual([]);
  });

  it('finds nothing for a title the text does not hold', () => {
    expect(marked(['Not cited here'])).toEqual([]);
  });

  it('marks the entry in the popup text, in the pick’s colour', () => {
    const fragment = citedWorksOverlay.highlightItemText!(
      square(1, 1),
      'x\n[2] A. B. (2020) Vega-Lite. Venue.\ny',
      'english' as never,
      { picked: [workId(0)] },
      data,
    );
    const [mark] = [...fragment.querySelectorAll('mark')];
    expect(mark.textContent).toBe('[2] A. B. (2020) Vega-Lite. Venue.');
    expect(fragment.textContent).toBe('x\n[2] A. B. (2020) Vega-Lite. Venue.\ny');
  });
});

describe('the citations overlay', () => {
  const link = (params: Record<string, string>) => citationsOverlay.settingsFromUrl!(params, []);

  it('opens on people, and a link can open it on works', () => {
    expect(link({}).view).toBe('people');
    expect(link({ cite: 'works' }).view).toBe('works');
  });

  it('keeps each list’s own picks through a link', () => {
    const settings = link({ cite: 'works', people: 'Jeffrey Heer', works: workId(0) });
    expect(settings.lists.people.picked).toEqual(['Jeffrey Heer']);
    expect(settings.lists.works.picked).toEqual([workId(0)]);
    expect(citationsOverlay.settingsToUrl!(settings)).toEqual({
      cite: 'works',
      people: 'Jeffrey Heer',
      works: workId(0),
    });
  });

  it('colours the papers by the list the toggle shows', () => {
    const settings = link({ people: 'Tamara Munzner', works: workId(0) });
    const colour = (view: 'people' | 'works') =>
      citationsOverlay.colorsFor([square(2)] as never, { ...settings, view }, null, data)[0];
    expect(colour('works')).toEqual(pickColors([0])[0]);
    expect(colour('people')).not.toEqual(colour('works'));
  });

  it('switches list when its toggle is clicked, leaving both lists’ picks', () => {
    const container = document.createElement('div');
    const settings = link({ people: 'Tamara Munzner' });
    const changes: unknown[] = [];
    citationsOverlay.renderControls!(
      container,
      settings,
      (update) => changes.push(update(settings, [])),
      data,
    );
    container.querySelector<HTMLButtonElement>('[data-view="works"]')!.click();
    expect(changes).toEqual([{ ...settings, view: 'works' }]);
  });
});

describe('the entries a square’s popup shows whole', () => {
  it('are the entries of the picked works in its text', () => {
    const text =
      '[1] X (2019) Other. V.\n[2] A. B. (2020) Vega-Lite. Venue.\n[3] Y (2018) More. V.';
    const found = citedWorksOverlay.textMatches!(
      square(1, 1),
      text,
      'english' as never,
      { picked: [workId(0)] },
      data,
    );
    expect(found.map(({ start, end }) => text.slice(start, end))).toEqual([
      '[2] A. B. (2020) Vega-Lite. Venue.',
    ]);
  });
});
