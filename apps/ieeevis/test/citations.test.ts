import { describe, it, expect } from 'vitest';
import { pickColors } from '@torahmap/shell/overlays/picks.ts';
import { peopleByPaper, worksByPaper, workId, type CitedData } from '../src/citations.ts';
import type { CitedWork, Structure } from '../src/data.ts';
import type { PieceItem } from '../src/layout.ts';
import { citationsOverlay } from '../src/overlays/citations.ts';
import { citedPeopleOverlay } from '../src/overlays/citedPeople.ts';
import { citedWorksOverlay } from '../src/overlays/citedWorks.ts';
import { picksOf } from '../src/overlays/listPicks.ts';

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

describe('the popup of a cited person', () => {
  const popup = (picked: string[], paper: number) =>
    citedPeopleOverlay.renderSidebarInfo!(squares(paper)[0] as never, true, { picked }, data);

  it('says the paper cites the person, and which of their works it cites', () => {
    const info = popup(['Jeffrey Heer'], 1)!;
    expect(info.firstChild?.textContent).toBe('cites: Jeffrey Heer');
    expect([...info.querySelectorAll('.pick-meta div')].map((l) => l.textContent)).toEqual([
      'Vega-Lite (2020)',
      'Interactive dynamics (2020)',
    ]);
  });

  it('lists only the works that paper cites', () => {
    const info = popup(['Jeffrey Heer'], 2)!;
    expect([...info.querySelectorAll('.pick-meta div')].map((l) => l.textContent)).toEqual([
      'Vega-Lite (2020)',
    ]);
  });

  it('says how many more when a person has many works in a paper', () => {
    const many: CitedData = {
      structure,
      cited: Array.from({ length: 7 }, (_, i) => work(`Work ${i}`, ['Ana Silva'], [0])),
    };
    const info = citedPeopleOverlay.renderSidebarInfo!(
      squares(0)[0] as never,
      true,
      { picked: ['Ana Silva'] },
      many,
    )!;
    const lines = [...info.querySelectorAll('.pick-meta div')].map((l) => l.textContent);
    expect(lines).toHaveLength(5);
    expect(lines[4]).toBe('and 3 more');
  });

  it('says nothing for a paper that cites none of the picked people', () => {
    expect(popup(['Tamara Munzner'], 2)).toBeNull();
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
      citationsOverlay.colorsFor(squares(2) as never, { ...settings, view }, null, data)[0];
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
