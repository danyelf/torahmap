import { describe, it, expect } from 'vitest';
import { baseColor } from '../src/baseColor.ts';
import { pickColors } from '@torahmap/shell/overlays/picks.ts';
import {
  peopleByPaper,
  sharedCitations,
  worksByPaper,
  workId,
  type CitedData,
} from '../src/citations.ts';
import type { CitedWork, Structure } from '../src/data.ts';
import type { PieceItem } from '../src/layout.ts';
import { citedPeopleOverlay } from '../src/overlays/citedPeople.ts';
import { citedWorksOverlay } from '../src/overlays/citedWorks.ts';
import { picksOf } from '../src/overlays/listPicks.ts';
import { sharedCitationsOverlay } from '../src/overlays/sharedCitations.ts';

const paper = (index: number) => ({
  index,
  title: `Paper ${index}`,
  authors: [],
  kind: 'Full VIS Paper',
  when: '',
  pieces: 'ai',
});
const structure: Structure = {
  days: [{ name: 'Mon', sessions: [{ name: 'S', start: '', papers: [0, 1, 2, 3].map(paper) }] }],
};
const work = (title: string, authors: string[], papers: number[], year: number | null = 2020) =>
  ({ title, year, authors, papers }) satisfies CitedWork;
const cited = [
  work('Vega-Lite', ['Arvind Satyanarayan', 'Jeffrey Heer'], [0, 1, 2]),
  work('Visualization Analysis and Design', ['Tamara Munzner'], [0, 1]),
  work('Interactive dynamics', ['Jeffrey Heer'], [1]),
  work('Anonymous note', [], [0], null),
];
const data: CitedData = { structure, cited };

const squares = (...papers: number[]) =>
  papers.map(
    (i) =>
      ({
        id: `${i}.0`,
        paper: structure.days[0].sessions[0].papers[i],
        section: 'a',
      }) as unknown as PieceItem,
  );

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

  it('counts the works two papers both cite', () => {
    const shared = sharedCitations(data);
    expect(shared.get(0)?.get(1)).toBe(2);
    expect(shared.get(0)?.get(2)).toBe(1);
    expect(shared.get(2)?.get(0)).toBe(1);
    expect(shared.get(0)?.has(0)).toBe(false);
  });
});

describe('the cited people overlay', () => {
  it('lights the papers that cite a person and dims the rest', () => {
    const [munzner, other] = citedPeopleOverlay.colorsFor(
      squares(0, 2) as never,
      { picked: ['Tamara Munzner'] },
      null,
      data,
    );
    expect(munzner).toEqual(pickColors([0])[0]);
    expect(other).not.toEqual(munzner);
  });
});

describe('the cited works overlay', () => {
  const heer = picksOf({ namesOf: (p, d: CitedData) => worksByPaper(d).get(p.index) ?? [] });

  it('lights the papers that cite a work, picked by its id', () => {
    const [cites, doesNot] = citedWorksOverlay.colorsFor(
      squares(2, 3) as never,
      { picked: [workId(0)] },
      null,
      data,
    );
    expect(cites).toEqual(pickColors([0])[0]);
    expect(doesNot).not.toEqual(cites);
    expect(heer.picked({ picked: [workId(0)] }, data)).toHaveLength(1);
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

describe('the shared citations overlay', () => {
  const colours = (pinned: number | null, ...papers: number[]) =>
    sharedCitationsOverlay.colorsFor(
      squares(...papers) as never,
      {},
      null,
      data,
      pinned === null ? null : (squares(pinned)[0] as never),
    );

  it('leaves the map as it is with nothing focused', () => {
    expect(colours(null, 3)[0]).toEqual(baseColor(squares(3)[0]));
    expect(colours(3, 3)[0]).not.toEqual(baseColor(squares(3)[0]));
  });

  it('colours a paper more strongly the more works it shares with the pinned one', () => {
    const [two, one, none] = colours(0, 1, 2, 3);
    expect(two).not.toEqual(one);
    expect(none).not.toEqual(one);
    expect(colours(0, 1)[0]).toEqual(two);
  });

  it('stands out the pinned paper and the papers sharing with it', () => {
    expect(
      sharedCitationsOverlay.standoutsFor!(
        squares(0, 1, 2, 3) as never,
        {},
        data,
        null,
        squares(0)[0] as never,
      ),
    ).toEqual([true, true, true, false]);
  });

  it('lists the sharing papers, strongest first, each a way to travel to it', () => {
    const container = document.createElement('div');
    const traveled: string[] = [];
    sharedCitationsOverlay.renderFocus!(container, null, squares(0)[0] as never, {}, data, (id) =>
      traveled.push(id),
    );
    const rows = [...container.querySelectorAll<HTMLButtonElement>('button')];
    expect(rows.map((r) => r.textContent)).toEqual(['Paper 12 works', 'Paper 21 work']);
    rows[0].click();
    expect(traveled).toEqual(['1.0']);
  });
});
