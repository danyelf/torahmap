import { describe, it, expect, vi } from 'vitest';
import { configureAnalytics } from '@torahmap/shell/analytics.ts';
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
  page: `https://ieeevis.org/year/2026/paper/${index}`,
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
/** Switches analytics on; the result reads the fields of each event sent, and switches it off. */
const recording = () => {
  const send = vi.fn<(body: string) => void>();
  configureAnalytics({ enabled: true, send, visitId: 'v' });
  return () => {
    configureAnalytics({ enabled: false });
    return send.mock.calls.map(([body]) => JSON.parse(body).fields);
  };
};
const colours = (picked: string[], ...papers: number[]) =>
  authorsOverlay.colorsFor({
    items: squares(...papers) as never,
    settings: { picked },
    data,
    focus: { hovered: null, pinned: null },
  });

describe('the authors overlay', () => {
  it('lights an author’s papers and dims the rest', () => {
    const [mine, other] = colours(['Bei Wang'], 1, 2);
    expect(mine).toEqual(pickColors([0])[0]);
    expect(other).not.toEqual(mine);
  });

  it('lights a paper’s squares that have no text dimmer than its text', () => {
    const [missing] = colours(['José Núñez'], 2) as [number, number, number][];
    const full = pickColors([0])[0] as [number, number, number];
    missing.forEach((c, i) => expect(c).toBeLessThan(full[i]));
  });

  it('splits a paper by two picked authors between their colours', () => {
    const [both] = colours(['Ana Silva', 'Bei Wang'], 0);
    expect(both).toEqual(pickColors([0, 1]));
  });

  it('stands out only the picked authors’ papers', () => {
    expect(
      authorsOverlay.standoutsFor!({
        items: squares(0, 1, 2) as never,
        settings: { picked: ['Ana Silva'] },
        data,
        focus: { hovered: null, pinned: null },
      }),
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
    keywordsOverlay.colorsFor({
      items: squares(...papers) as never,
      settings: { picked },
      data,
      focus: { hovered: null, pinned: null },
    });

  it('lights the papers that list a keyword, and dims the ones that list none', () => {
    const [listed, none] = colourOf(['Visual analytics'], 1, 2);
    expect(listed).toEqual(pickColors([0])[0]);
    expect(none).not.toEqual(listed);
  });

  it('splits a paper listing two picked keywords between their colours', () => {
    expect(colourOf(['Visual analytics', 'Uncertainty'], 0)[0]).toEqual(pickColors([0, 1]));
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
      () => {},
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

  it('record each pick and unpick with the overlay and the name as shown', () => {
    const sent = recording();
    open({ picked: [] })
      .chips.find((c) => c.textContent === 'Visual Analytics')!
      .click();
    open({ picked: ['Uncertainty'] })
      .chips.find((c) => c.textContent === 'Uncertainty')!
      .click();
    expect(sent()).toEqual([
      { overlay: 'keywords', pick: 'Visual Analytics', how: 'quick' },
      { overlay: 'keywords', pick: 'Uncertainty', how: 'unpick' },
    ]);
  });
});

describe('the papers the picks light', () => {
  const open = (picked: string[]) => {
    const container = document.createElement('div');
    const travels: string[] = [];
    authorsOverlay.renderControls!(
      container,
      { picked },
      () => {},
      data,
      (id) => travels.push(id),
    );
    const rows = [...container.querySelectorAll<HTMLElement>('.search-result')];
    return { rows, travels };
  };

  it('are listed in program order, a dot for each pick that lists one', () => {
    const { rows } = open(['Bei Wang', 'Ana Silva']);
    expect(rows.map((r) => r.querySelectorAll('.term-dot').length)).toEqual([2, 1]);
  });

  it('take the reader to a paper’s first square when one is clicked', () => {
    const { rows, travels } = open(['Bei Wang']);
    rows[1].click();
    expect(travels).toEqual(['1.0']);
  });

  it('are not listed while nothing is picked', () => {
    expect(open([]).rows).toEqual([]);
  });
});

describe('the quick picks once something is picked', () => {
  const open = (picked: string[]) => {
    const container = document.createElement('div');
    authorsOverlay.renderControls!(
      container,
      { picked },
      () => {},
      data,
      () => {},
    );
    return container;
  };
  const chipsShown = (container: HTMLElement) =>
    !container.querySelector<HTMLElement>('.pick-quick-body')!.hidden;

  it('show with no link while nothing is picked', () => {
    const container = open([]);
    expect(container.querySelector('.pick-quick-link')).toBeNull();
    expect(chipsShown(container)).toBe(true);
  });

  it('fold behind a link that shows and hides them, above the list', () => {
    const container = open(['Bei Wang']);
    const link = container.querySelector<HTMLButtonElement>('.pick-quick-link')!;
    expect(chipsShown(container)).toBe(false);
    link.click();
    expect(chipsShown(container)).toBe(true);
    link.click();
    expect(chipsShown(container)).toBe(false);
    const order = [...container.querySelectorAll('.pick-picked, .pick-quick, .results-box')];
    expect(order.map((el) => el.className)).toEqual(['pick-picked', 'pick-quick', 'results-box']);
  });
});

describe('a typed pick', () => {
  it('is recorded as typed', () => {
    const sent = recording();
    const container = document.createElement('div');
    authorsOverlay.renderControls!(
      container,
      { picked: [] },
      () => {},
      data,
      () => {},
    );
    const input = container.querySelector('input')!;
    input.value = 'nunez';
    input.dispatchEvent(new Event('input'));
    container.querySelector<HTMLButtonElement>('.pick-row')!.click();
    expect(sent()).toEqual([{ overlay: 'authors', pick: 'José Núñez', how: 'typed' }]);
  });
});
