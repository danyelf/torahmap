import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import { HEBREW } from '@torahmap/shell/language.ts';
import type { TalmudDating } from '../src/dating.ts';
import { DATING_FILE } from '../src/dating.ts';
import { RABBIS_FILE, type TalmudRabbis } from '../src/rabbis.ts';
import { addPick, rabbisOverlay } from '../src/overlays/rabbis.ts';
import { pickColors, type RabbiData, type RabbiSettings } from '../src/overlays/rabbiPicks.ts';

const rabbis: TalmudRabbis = {
  rabbis: [
    { id: 'gamliel-a', en: 'Rabban Gamliel haZaken', he: 'רבן גמליאל', gen: 'T1', names: [] },
    { id: 'gamliel-b', en: 'Rabban Gamliel b. Rabbi', he: 'רבן גמליאל', gen: 'TA', names: [] },
    {
      id: 'lakish',
      en: 'Rabbi Shimon b. Lakish',
      he: 'ריש לקיש',
      gen: 'A2',
      names: ['Reish Lakish'],
    },
    { id: 'yochanan', en: 'Rabbi Yochanan', he: 'רבי יוחנן', gen: 'A2', names: [] },
  ],
  readings: [
    [0, 0, 1],
    [1, 2],
    [1, 3],
  ],
};

const dating: TalmudDating = {
  generations: [{ code: 'A2', from: 250, to: 290 }],
  people: [
    { id: 'gamliel-(ambiguous)', en: 'Rabban Gamliel', he: 'רבן גמליאל', gen: 0, ambiguous: true },
    { id: 'lakish', en: 'Rabbi Shimon b. Lakish', he: 'ריש לקיש', gen: 0 },
    { id: 'yochanan', en: 'Rabbi Yochanan', he: 'רבי יוחנן', gen: 0 },
  ],
  segments: {
    'A.2a.1': [0, 0, [1, 2], [0, 3, 1, 4, 9, 2]],
    'A.2a.2': [0, 0, [1], []],
    'A.2a.3': [0, 1, [0], []],
    'A.2a.4': [0, 0, [], []],
  },
};

const data: RabbiData = { dating, rabbis };
const item = (id: string) => ({ id, x: 0, y: 0, size: 6 }) as never;
const base = () => [0.6, 0.5, 0.4] as [number, number, number];
const link: { open?: (id: string) => void } = {};
const overlay = rabbisOverlay(base, link);
const picking = (...picked: string[]): RabbiSettings => ({ picked });
const colours = (settings: RabbiSettings, ...ids: string[]) =>
  overlay.colorsFor(ids.map(item), settings, null, data);
const unlitColour = colours(picking('lakish'), 'A.2a.4')[0];

describe('the rabbis overlay colours', () => {
  it('shows the plain map while nothing is picked', () => {
    expect(colours(picking(), 'A.2a.1', 'A.2a.4')).toEqual([base(), base()]);
  });

  it('lights the passages naming a picked rabbi and dims the rest', () => {
    const [lit, other, unlit] = colours(picking('lakish'), 'A.2a.2', 'A.2a.3', 'A.2a.4');
    expect(lit).toEqual(pickColors([rabbis.rabbis[2]])[0]);
    expect(other).toEqual(unlitColour);
    expect(unlit).toEqual(unlitColour);
    expect(unlitColour).not.toEqual(base());
  });

  it('splits a passage naming two picked rabbis between their colours', () => {
    const [both] = colours(picking('lakish', 'yochanan'), 'A.2a.1');
    const expected = pickColors([rabbis.rabbis[2], rabbis.rabbis[3]]);
    expect(both).toEqual(expected);
    expect(expected[0]).not.toEqual(expected[1]);
  });

  it('fades a passage where a name only might be the rabbi', () => {
    const [sure] = colours(picking('gamliel-a', 'lakish'), 'A.2a.2');
    const [maybe] = colours(picking('gamliel-a'), 'A.2a.3');
    const solid = pickColors([rabbis.rabbis[0]])[0];
    expect(maybe).not.toEqual(solid);
    expect(maybe).not.toEqual(unlitColour);
    expect(sure).not.toEqual(unlitColour);
  });

  it('never splits a square into more colours than it can show', () => {
    const many: TalmudRabbis = {
      rabbis: Array.from({ length: 6 }, (_, i) => ({
        id: `r${i}`,
        en: `R${i}`,
        he: '',
        gen: 'A2',
        names: [],
      })),
      readings: [
        [1, 0],
        [1, 1],
        [1, 2],
        [1, 3],
        [1, 4],
        [1, 5],
      ],
    };
    const crowd: TalmudDating = {
      ...dating,
      people: many.rabbis.map((r) => ({ id: r.id, en: r.en, he: '', gen: 0 })),
      segments: { 'A.2a.1': [0, 0, [0, 1, 2, 3, 4, 5], []] },
    };
    const [drawn] = overlay.colorsFor(
      [item('A.2a.1')],
      picking('r0', 'r1', 'r2', 'r3', 'r4', 'r5'),
      null,
      { dating: crowd, rabbis: many },
    );
    expect(drawn).toHaveLength(4);
  });

  it('marks lit passages to stand out', () => {
    const lit = overlay.standoutsFor!(
      ['A.2a.1', 'A.2a.3', 'A.2a.4'].map(item),
      picking('lakish', 'gamliel-a'),
      data,
    );
    expect(lit).toEqual([true, true, false]);
  });

  it('ignores a pick the data does not hold', () => {
    expect(colours(picking('nobody'), 'A.2a.1')).toEqual([base()]);
  });
});

describe('the rabbis link', () => {
  it('carries the picks and comes back as the same picks', () => {
    const settings = picking('lakish', 'gamliel-a');
    const written = overlay.settingsToUrl!(settings);
    expect(overlay.settingsFromUrl!(written)).toEqual(settings);
  });

  it('writes nothing when nothing is picked', () => {
    expect(overlay.settingsToUrl!(picking())).toEqual({});
  });
});

describe('picking a rabbi from a name', () => {
  it('adds him to the picks', () => {
    expect(addPick('yochanan')(picking('lakish'))).toEqual(picking('lakish', 'yochanan'));
  });

  it('changes nothing if he is already picked', () => {
    const current = picking('lakish');
    expect(addPick('lakish')(current)).toBe(current);
  });
});

describe('the pinned passage', () => {
  const info = (id: string, settings = picking('lakish')) =>
    overlay.renderSidebarInfo!(item(id), true, settings, data)!;

  it('opens a rabbi on the Rabbis map when his name is clicked', () => {
    const open = vi.fn();
    link.open = open;
    info('A.2a.1').querySelector<HTMLButtonElement>('.rabbi-name')!.click();
    expect(open).toHaveBeenCalledWith('lakish');
    link.open = undefined;
  });

  it('shows the colour of a picked rabbi beside his name', () => {
    const box = info('A.2a.1');
    expect(box.querySelectorAll('.picked .swatch')).toHaveLength(1);
    expect(box.textContent).toContain(rabbis.rabbis[3].en);
  });

  it('lists a name that could be several rabbis with a question mark, not as a button', () => {
    link.open = () => {};
    const box = info('A.2a.3');
    link.open = undefined;
    expect(box.textContent).toContain('Rabban Gamliel');
    expect(box.textContent).toContain('?');
    expect(box.querySelector('button')).toBeNull();
  });

  it('marks only the picked rabbi’s name in the Hebrew', () => {
    const text = 'ריש יוחנן';
    const words = (settings: RabbiSettings) =>
      [
        ...overlay.highlightItemText!(
          item('A.2a.1'),
          text,
          HEBREW,
          settings,
          data,
        ).querySelectorAll('mark'),
      ].map((m) => m.textContent);
    expect(words(picking('lakish'))).toEqual(['ריש']);
    expect(words(picking('yochanan'))).toEqual(['יוחנן']);
    expect(words(picking())).toEqual([]);
  });
});

describe('the finder', () => {
  function open(settings = picking()) {
    const container = document.createElement('div');
    document.body.append(container);
    const changes: RabbiSettings[] = [];
    let current = settings;
    const draw = () =>
      overlay.renderControls!(
        container,
        current,
        (update) => {
          current = update(current);
          changes.push(current);
          draw();
        },
        data,
      );
    draw();
    const type = (text: string) => {
      const input = container.querySelector('input')!;
      input.value = text;
      input.dispatchEvent(new Event('input'));
    };
    return { container, type, changes, rows: () => [...container.querySelectorAll('.rabbi-row')] };
  }

  it('suggests a rabbi by another name and picks him on click', () => {
    const finder = open();
    finder.type('reish');
    expect(finder.rows()).toHaveLength(1);
    (finder.rows()[0] as HTMLElement).click();
    expect(finder.changes).toEqual([picking('lakish')]);
  });

  it('offers every person who shares a name so the reader chooses', () => {
    const finder = open();
    finder.type('gamliel');
    expect(finder.rows().map((r) => r.textContent)).toEqual([
      expect.stringContaining('Rabban Gamliel haZaken'),
      expect.stringContaining('Rabban Gamliel b. Rabbi'),
    ]);
  });

  it('shows a picked rabbi with his colour and unpicks him', () => {
    const finder = open(picking('lakish'));
    expect(finder.container.querySelectorAll('.rabbi-picked-row .swatch')).toHaveLength(1);
    finder.container.querySelector<HTMLButtonElement>('.rabbi-picked-row button')!.click();
    expect(finder.changes).toEqual([picking()]);
  });

  it('asks which person when a quick pick is a shared name', () => {
    const finder = open();
    const chip = [...finder.container.querySelectorAll<HTMLButtonElement>('.rabbi-chip')].find(
      (c) => c.textContent?.startsWith('Rabban Gamliel'),
    )!;
    chip.click();
    expect(finder.container.querySelector('.rabbi-which')?.textContent).toContain('Which');
    expect(finder.rows()).toHaveLength(2);
    (finder.rows()[1] as HTMLElement).click();
    expect(finder.changes).toEqual([picking('gamliel-b')]);
  });

  it('keeps the box and what was typed when the picks change', () => {
    const finder = open();
    const box = finder.container.querySelector('input')!;
    finder.type('yoch');
    overlay.renderControls!(finder.container, picking('lakish'), () => {}, data);
    expect(finder.container.querySelector('input')).toBe(box);
    expect(box.value).toBe('yoch');
  });
});

describe('the shipped rabbis file', () => {
  const shippedRabbis = JSON.parse(
    readFileSync(`public/data/${RABBIS_FILE}`, 'utf-8'),
  ) as TalmudRabbis;
  const shippedDating = JSON.parse(
    readFileSync(`public/data/${DATING_FILE}`, 'utf-8'),
  ) as TalmudDating;

  it('reads every person the dating file lists', () => {
    expect(shippedRabbis.readings).toHaveLength(shippedDating.people.length);
    for (const [, ...who] of shippedRabbis.readings) {
      for (const place of who) expect(shippedRabbis.rabbis[place]).toBeDefined();
    }
  });

  it('gives each rabbi a unique id and a generation', () => {
    const ids = shippedRabbis.rabbis.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of shippedRabbis.rabbis) expect(r.gen).toMatch(/^(?:[ZTA]\d|TA)$/);
  });

  it('reads a person who is not an ambiguous name as himself, for certain', () => {
    shippedDating.people.forEach((person, i) => {
      if (person.ambiguous) return;
      const [sure, place] = shippedRabbis.readings[i];
      expect(sure).toBe(1);
      expect(shippedRabbis.rabbis[place].id).toBe(person.id);
    });
  });
});
