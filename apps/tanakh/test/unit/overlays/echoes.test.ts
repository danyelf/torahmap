import { describe, it, expect, beforeEach } from 'vitest';
import { echoesOverlay, type EchoesData } from '../../../src/overlays/echoes';
import { brighten, type Color } from '@torahmap/utils';
import { getDefaultColor } from '../../../src/baseColor';
import { DISTANCE_STEPS } from '../../../src/overlays/echoes/distance';
import { createVerse } from '../../helpers/fixtures';
import { initBookData } from '../../../src/books';
import type { TanakhLayout } from '../../../src/types';
import { hostOverlay } from '../../helpers/overlayHost';
import { ENGLISH, HEBREW } from '@torahmap/shell/language.ts';

const data: EchoesData = {
  // Verses 1 and 4 share a run of five words.
  echoes: { 0: [3, 5] },
  texts: {
    Genesis: {
      '1': Object.fromEntries(
        [1, 2, 3, 4].map((v) => [v, { he: 'אבג־דהו (זחט) [יכל] מנס־עפצ קרש תאב שין', en: '' }]),
      ),
    },
  },
};

const verse = (n: number) => createVerse({ book: 'Genesis', chapter: 1, verse: n });

function host() {
  return hostOverlay(echoesOverlay, data);
}

const echoSettings = { words: 5 };

describe('Echoes overlay', () => {
  beforeEach(() =>
    initBookData({
      books: [
        { name: 'Genesis', hebrewName: '', section: 'torah', chapters: [4], countedAs: 'Genesis' },
      ],
      layout: { minorProphetStacks: [], ketuvimStacks: [], multiColumnBooks: {} },
    }),
  );

  it("lists the focused verse's echoes in words, and nothing for a verse without any", () => {
    const say = (v: number) => {
      const panel = document.createElement('div');
      echoesOverlay.renderFocus!(panel, verse(v), null, echoSettings, data, () => {});
      return panel.textContent;
    };
    expect(say(1)).toContain('Genesis 1:4');
    expect(say(2)).toBe('');
  });

  it('makes the focused verse and its echoes stand out, and nothing else', () => {
    const items = [1, 2, 3, 4].map(verse);
    const settings = echoSettings;
    expect(
      echoesOverlay.standoutsFor!({
        items,
        settings,
        data,
        focus: { hovered: verse(1), pinned: null },
      }),
    ).toEqual([true, false, false, true]);
    expect(
      echoesOverlay.standoutsFor!({
        items,
        settings,
        data,
        focus: { hovered: verse(2), pinned: null },
      }),
    ).toEqual([false, false, false, false]);
  });

  it('travels to a parallel verse from its link in the panel', () => {
    const panel = document.createElement('div');
    const traveled: string[] = [];
    echoesOverlay.renderFocus!(panel, verse(1), null, echoSettings, data, (id) =>
      traveled.push(id),
    );
    [...panel.querySelectorAll('button')]
      .find((b) => b.textContent!.includes('Genesis 1:4'))!
      .click();
    expect(traveled).toEqual([verse(4).id]);
  });

  it('lists the focused verse among its parallels, in canonical order', () => {
    const refs = (focus: number) => {
      const panel = document.createElement('div');
      echoesOverlay.renderFocus!(panel, verse(focus), null, echoSettings, data, () => {});
      return [...panel.querySelectorAll('.parallel-ref')].map((ref) => ref.textContent);
    };
    expect(refs(1)).toEqual(['Genesis 1:1', 'Genesis 1:4']);
    expect(refs(4)).toEqual(['Genesis 1:1', 'Genesis 1:4']);
  });

  it('colors the map as usual when neither the hovered nor the pinned verse has echoes', () => {
    const items = [1, 2, 3, 4].map(verse);
    const paint = (focus: { hovered: TanakhLayout | null; pinned: TanakhLayout | null }) =>
      echoesOverlay.colorsFor!({ items, settings: echoSettings, data, focus });
    expect(paint({ hovered: verse(2), pinned: verse(3) })).toEqual(
      paint({ hovered: null, pinned: null }),
    );
  });

  it('keeps a pinned verse in focus under the pointer, and compares it with its echo alone', () => {
    const panel = document.createElement('div');
    echoesOverlay.renderFocus!(panel, verse(4), verse(1), echoSettings, data, () => {});
    expect(panel.querySelector('.parallel-source .parallel-ref')!.textContent).toBe('Genesis 1:1');
    const { comparesWith } = echoesOverlay;
    expect(comparesWith!(verse(1), verse(4), echoSettings, data)).toBe(true);
    expect(comparesWith!(verse(1), verse(2), echoSettings, data)).toBe(false);
    expect(comparesWith!(verse(1), verse(1), echoSettings, data)).toBe(false);
  });

  it("shows a pinned verse's echoes while the pointer is on a verse with none", () => {
    const items = [1, 2, 3, 4].map(verse);
    const settings = echoSettings;
    const plain = items.map((item) => host().getItemColor(item));
    const pinOnly = echoesOverlay.colorsFor!({
      items,
      settings,
      data,
      focus: { hovered: null, pinned: verse(1) },
    });
    expect(pinOnly[3]).not.toEqual(plain[3]);
    // A hover on a verse with none leaves the pin's showing.
    expect(
      echoesOverlay.colorsFor!({
        items,
        settings,
        data,
        focus: { hovered: verse(2), pinned: verse(1) },
      }),
    ).toEqual(pinOnly);
    expect(
      echoesOverlay.standoutsFor!({
        items,
        settings,
        data,
        focus: { hovered: null, pinned: verse(1) },
      }),
    ).toEqual([true, false, false, true]);
  });

  it('repaints on a pin only when it starts or ends on a verse with echoes', () => {
    const { pinChangesColors } = echoesOverlay;
    const settings = echoSettings;
    expect(pinChangesColors!(null, verse(1), settings, data)).toBe(true);
    expect(pinChangesColors!(verse(2), verse(3), settings, data)).toBe(false);
  });

  it('repaints on a hover only when it starts or ends on a verse with echoes', () => {
    const h = host();
    expect(h.hoverChangesColors(null, verse(1))).toBe(true);
    expect(h.hoverChangesColors(verse(1), verse(4))).toBe(true);
    expect(h.hoverChangesColors(verse(2), verse(3))).toBe(false);
    expect(h.hoverChangesColors(verse(2), null)).toBe(false);
  });

  it('gives no hover for a verse without echoes', () => {
    const h = host();
    expect(h.getHoverInfo(verse(1))).not.toBeNull();
    expect(h.getHoverInfo(verse(2))).toBeNull();
  });

  const items = [1, 2, 3, 4].map(verse);
  const colors = (
    echoes: EchoesData['echoes'],
    hovered: ReturnType<typeof verse> | null,
    words = 5,
  ) =>
    echoesOverlay.colorsFor!({
      items,
      settings: { words },
      data: {
        ...data,
        echoes,
      },
      focus: { hovered, pinned: null },
    });

  it('shows a verse without echoes in a darker map gray', () => {
    const [first, second] = colors({ 0: [3, 5] }, null);
    expect(first).not.toEqual(brighten(getDefaultColor(0), 0.6));
    expect(second).toEqual(brighten(getDefaultColor(1), 0.6));
    expect(colors({}, null)[0]).toEqual(brighten(getDefaultColor(0), 0.6));
  });

  it('counts only the echoes sharing at least the chosen words in a row', () => {
    const echoes = { 0: [3, 5], 1: [2, 7] };
    expect(colors(echoes, null, 6)[0]).toEqual(colors({}, null)[0]);
    expect(colors(echoes, null, 6)[1]).not.toEqual(colors({}, null)[1]);
    expect(colors(echoes, null, 8)[1]).toEqual(colors({}, null)[1]);
    const say = (words: number) => {
      const panel = document.createElement('div');
      echoesOverlay.renderFocus!(panel, verse(1), null, { words }, data, () => {});
      return panel.textContent;
    };
    expect(say(5)).toContain('Genesis 1:4');
    expect(say(6)).toBe('');
  });

  describe('by distance', () => {
    // In reading order: Genesis 1:1, Genesis 1:2, Genesis 2:1, Exodus 1:1, Isaiah 1:1, Psalms 1:1.
    beforeEach(() =>
      initBookData({
        books: ['Genesis', 'Exodus', 'Isaiah', 'Psalms'].map((name, i) => ({
          name,
          hebrewName: '',
          section: (['torah', 'torah', 'neviim', 'ketuvim'] as const)[i],
          chapters: name === 'Genesis' ? [2, 1] : [1],
          countedAs: name,
        })),
        layout: { minorProphetStacks: [], ketuvimStacks: [], multiColumnBooks: {} },
      }),
    );
    const places = [
      createVerse({ book: 'Genesis', chapter: 1, verse: 1 }),
      createVerse({ book: 'Genesis', chapter: 1, verse: 2 }),
      createVerse({ book: 'Genesis', chapter: 2, verse: 1 }),
      createVerse({ book: 'Exodus', chapter: 1, verse: 1 }),
      createVerse({ book: 'Isaiah', chapter: 1, verse: 1 }),
      createVerse({ book: 'Psalms', chapter: 1, verse: 1 }),
    ];
    const paint = (
      echoes: EchoesData['echoes'],
      hovered: (typeof places)[number] | null = null,
      pinned: (typeof places)[number] | null = null,
    ) =>
      echoesOverlay.colorsFor!({
        items: places,
        settings: echoSettings,
        data: { ...data, echoes },
        focus: { hovered, pinned },
      });
    const [chapter, book, section, other] = DISTANCE_STEPS.map((step) => step.color);
    const light = (color: Color) => color[0] + color[1] + color[2];

    it('colors a verse by the distance of its farthest echo', () => {
      expect(paint({ 0: [1, 5] })[0]).toEqual(chapter);
      expect(paint({ 0: [1, 5, 2, 5] })[0]).toEqual(book);
      expect(paint({ 0: [1, 5, 2, 5, 3, 5] })[0]).toEqual(section);
      expect(paint({ 0: [1, 5, 2, 5, 3, 5, 4, 5, 5, 5] })[0]).toEqual(other);
    });

    it("lights a focused verse's echoes, and sets the verse apart", () => {
      const echoes = { 0: [1, 5, 2, 5, 3, 5, 4, 5, 5, 5], 1: [5, 5] };
      const resting = paint(echoes);
      const colors = paint(echoes, places[0]);
      expect(colors[0]).not.toEqual(resting[0]);
      colors.slice(1).forEach((color, i) => {
        expect(light(color as Color)).toBeGreaterThan(light(resting[i + 1] as Color));
      });
    });

    it('darkens other verses with echoes, and leaves the rest plain', () => {
      const echoes = { 0: [1, 5], 2: [3, 5] };
      const resting = paint(echoes);
      const faded = paint(echoes, null, places[0]);
      expect(light(faded[2] as Color)).toBeLessThan(light(resting[2] as Color));
      expect(faded[2]).not.toEqual(brighten(getDefaultColor(2), 0.6));
      expect(faded[4]).toEqual(brighten(getDefaultColor(4), 0.6));
    });

    it('fades them the same whether the focused verse is pinned or hovered', () => {
      const echoes = { 0: [1, 5], 2: [3, 5] };
      expect(paint(echoes, places[0])).toEqual(paint(echoes, null, places[0]));
    });

    it('shows the pinned verse again when the pointer is on a verse without echoes', () => {
      const echoes = { 0: [1, 5], 2: [3, 5] };
      expect(paint(echoes, places[5], places[0])).toEqual(paint(echoes, null, places[0]));
    });

    it('keeps a pinned verse in focus when the pointer is on another verse with echoes', () => {
      const echoes = { 0: [1, 5], 2: [3, 5] };
      expect(paint(echoes, places[2], places[0])).toEqual(paint(echoes, null, places[0]));
    });

    it('compares a pinned verse with its echoes, and with no other verse', () => {
      const compares = (other: (typeof places)[number]) =>
        echoesOverlay.comparesWith!(places[0], other, echoSettings, {
          ...data,
          echoes: { 0: [1, 5], 2: [3, 5] },
        });
      expect(compares(places[1])).toBe(true);
      expect(compares(places[2])).toBe(false);
      expect(compares(places[0])).toBe(false);
    });

    const comparing = { hovered: null, pinned: places[0], compared: places[2] };

    it('lights only the echo a pinned verse is compared with', () => {
      const echoes = { 0: [2, 5, 3, 5] };
      const colors = echoesOverlay.colorsFor!({
        items: places,
        settings: echoSettings,
        data: { ...data, echoes },
        focus: comparing,
      });
      expect(colors[2]).toEqual(paint(echoes, null, places[0])[2]);
      expect(colors[3]).toEqual(paint(echoes)[3]);
    });

    it('grows the pointers between a pinned verse and the echo it is compared with brightest', () => {
      const echoes = { 0: [2, 5, 3, 5] };
      const grown = echoesOverlay.grownPointersFor!({
        items: places,
        settings: echoSettings,
        data: { ...data, echoes },
        focus: comparing,
      });
      // The pointers come verse by verse: the first verse's two, then one back from each echo.
      const opacity = (index: number) => grown.find((g) => g.index === index)!.opacity;
      expect(opacity(0)).toBeGreaterThan(opacity(1));
      expect(opacity(2)).toBeGreaterThan(opacity(3));
    });

    it('dims no pointer while the pinned verse is compared with an echo in its own chapter', () => {
      const grown = (compared: (typeof places)[number] | null) =>
        echoesOverlay.grownPointersFor!({
          items: places,
          settings: echoSettings,
          data: { ...data, echoes: { 0: [1, 5, 2, 5, 3, 5] } },
          focus: { hovered: null, pinned: places[0], compared },
        });
      expect(grown(places[1])).toEqual(grown(null));
    });

    const pointers = (items: typeof places, echoes: EchoesData['echoes']) =>
      echoesOverlay.pointersFor!({
        items,
        settings: echoSettings,
        data: { ...data, echoes },
      });

    it('grows the pointers toward echoes in other chapters, and not the one within the chapter', () => {
      const echoes = { 0: [1, 5, 2, 5] };
      const drawn = pointers(places, echoes);
      const grown = echoesOverlay.grownPointersFor!({
        items: places,
        settings: echoSettings,
        data: { ...data, echoes },
        focus: { hovered: places[0], pinned: null },
      });
      expect(drawn.map((p) => p.color)).toContainEqual(chapter);
      expect(grown.length).toBeGreaterThan(0);
      expect(grown.map(({ index }) => drawn[index].color)).not.toContainEqual(chapter);
    });

    it('draws the pointers of a verse with many echoes shorter', () => {
      const chapters = 15;
      initBookData({
        books: [
          {
            name: 'Genesis',
            hebrewName: '',
            section: 'torah',
            chapters: new Array(chapters).fill(1),
            countedAs: 'Genesis',
          },
        ],
        layout: { minorProphetStacks: [], ketuvimStacks: [], multiColumnBooks: {} },
      });
      const verses = Array.from({ length: chapters }, (_, c) =>
        createVerse({ book: 'Genesis', chapter: c + 1, verse: 1 }),
      );
      const toEveryOther = verses.slice(1).flatMap((_, i) => [i + 1, 5]);
      const [fromTheMany, ...rest] = pointers(verses, { 0: toEveryOther });
      expect(fromTheMany.length).toBeLessThan(rest.at(-1)!.length);
    });
  });

  describe('marking the shared phrase', () => {
    const he = (words: string[]) => ({ he: words.join(' '), en: '' });
    const marking: EchoesData = {
      ...data,
      echoes: { 0: [3, 5] },
      texts: {
        Genesis: {
          '1': {
            1: he(['אבג', 'דהו', 'זחט', 'יכל', 'מנס', 'עפצ', 'קרש']),
            4: he(['תאב', 'זחט', 'יכל', 'מנס', 'עפצ', 'קרש', 'שין']),
          },
        },
      },
    };
    const marked = (fragment: DocumentFragment) =>
      [...fragment.querySelectorAll('mark')].map((mark) => mark.textContent);

    it('marks the words of a verse that sit in a run it shares with another verse', () => {
      const text = marking.texts!.Genesis['1'][1].he;
      expect(
        marked(echoesOverlay.highlightItemText!(verse(1), text, HEBREW, echoSettings, marking)),
      ).toEqual(['זחט יכל מנס עפצ קרש']);
      expect(
        marked(echoesOverlay.highlightItemText!(verse(1), text, ENGLISH, echoSettings, marking)),
      ).toEqual([]);
      expect(
        marked(echoesOverlay.highlightItemText!(verse(1), text, HEBREW, { words: 6 }, marking)),
      ).toEqual([]);
    });

    it('marks the run each parallel in the list shares with the focused verse', () => {
      const panel = document.createElement('div');
      echoesOverlay.renderFocus!(panel, verse(1), null, echoSettings, marking, () => {});
      // Once in the focused verse, once in its parallel.
      expect([...panel.querySelectorAll('mark')].map((mark) => mark.textContent)).toEqual([
        'זחט יכל מנס עפצ קרש',
        'זחט יכל מנס עפצ קרש',
      ]);
    });

    it('marks what a pinned verse and a compared echo share, and what its other echoes share more faintly', () => {
      const first = ['אבג', 'דהו', 'זחט', 'יכל', 'מנס'];
      const second = ['עפצ', 'קרש', 'שין', 'תאב', 'גדה'];
      const three: EchoesData = {
        ...data,
        echoes: { 0: [1, 5, 3, 5] },
        texts: {
          Genesis: {
            '1': { 1: he([...first, 'וזח', ...second]), 2: he(first), 4: he(['טיכ', ...second]) },
          },
        },
      };
      const [ours, theirs] = echoesOverlay.compareTexts!(
        verse(1),
        [three.texts!.Genesis['1'][1].he, three.texts!.Genesis['1'][4].he],
        echoSettings,
        three,
      );
      const fainter = [...ours.querySelectorAll('mark.fainter')].map((m) => m.textContent);
      expect(fainter).toEqual([first.join(' ')]);
      expect(marked(ours).filter((text) => !fainter.includes(text))).toEqual([second.join(' ')]);
      expect(marked(theirs)).toEqual([second.join(' ')]);
    });

    describe('the list beside a pinned verse', () => {
      const did: string[] = [];
      const travel = (id: string) => void did.push(`travel ${id}`);
      const hover = (id: string | null) => void did.push(`hover ${id}`);
      const hold = (id: string) => void did.push(`hold ${id}`);
      const draw = (panel: HTMLElement, held: ReturnType<typeof verse> | null) =>
        echoesOverlay.renderFocus!(panel, null, verse(1), echoSettings, marking, travel, {
          compared: held,
          held,
          hover,
          hold,
        });
      const parallel = (panel: HTMLElement) =>
        [...panel.querySelectorAll('button')].find((b) => b.textContent!.includes('Genesis 1:4'))!;

      beforeEach(() => {
        did.length = 0;
      });

      it('holds a parallel for comparison on its first click, and travels to it on the second', () => {
        const panel = document.createElement('div');
        draw(panel, null);
        parallel(panel).click();
        draw(panel, verse(4));
        parallel(panel).click();
        expect(did.filter((d) => !d.startsWith('hover'))).toEqual([
          `hold ${verse(4).id}`,
          `travel ${verse(4).id}`,
        ]);
      });

      it('takes the pointer off a row it travels from, which is redrawn under it', () => {
        const panel = document.createElement('div');
        draw(panel, verse(4));
        parallel(panel).dispatchEvent(new MouseEvent('mouseenter'));
        parallel(panel).click();
        expect(did).toEqual([`hover ${verse(4).id}`, 'hover null', `travel ${verse(4).id}`]);
      });

      it('draws its rows again in a panel emptied since', () => {
        const panel = document.createElement('div');
        draw(panel, null);
        panel.replaceChildren();
        draw(panel, null);
        expect(parallel(panel)).toBeDefined();
      });

      it('says when the pointer is on a parallel, and when it leaves', () => {
        const panel = document.createElement('div');
        draw(panel, null);
        parallel(panel).dispatchEvent(new MouseEvent('mouseenter'));
        parallel(panel).dispatchEvent(new MouseEvent('mouseleave'));
        expect(did).toEqual([`hover ${verse(4).id}`, 'hover null']);
      });

      it('keeps its rows when only the comparison changes, so a scrolled list stays put', () => {
        const panel = document.createElement('div');
        draw(panel, null);
        const row = parallel(panel);
        draw(panel, verse(4));
        expect(parallel(panel)).toBe(row);
      });

      it('empties when the focus goes', () => {
        const panel = document.createElement('div');
        draw(panel, null);
        echoesOverlay.renderFocus!(panel, null, null, echoSettings, marking, travel);
        expect(panel.childNodes).toHaveLength(0);
      });
    });
  });

  it('names the words in a row in the link', () => {
    expect(host().fromUrl({ words: '7' })).toEqual({ words: 7 });
    expect(echoesOverlay.settingsToUrl!({ words: 7 })).toEqual({ words: '7' });
  });

  it('reports a move of the words slider', () => {
    const h = host();
    const slider = h.renderControls().querySelector('input')!;
    slider.value = '8';
    slider.dispatchEvent(new Event('input'));
    expect(h.settings).toEqual({ words: 8 });
  });
});
