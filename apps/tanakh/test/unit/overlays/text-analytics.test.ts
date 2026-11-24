import { describe, it, expect } from 'vitest';
import { textAnalyticsOverlay, type TextAnalyticsData } from '../../../src/overlays/text-analytics';
import { NO_DATA } from '../../../src/overlays/colors';
import { brighten, type Color } from '@torahmap/utils';
import { getDefaultColor } from '../../../src/baseColor';
import { DISTANCE_STEPS } from '../../../src/overlays/text-analytics/distance';
import { createVerse, SAMPLE_TEXT_ANALYTICS_SCORES } from '../../helpers/fixtures';
import { initBookData } from '../../../src/books';
import { hostOverlay } from '../../helpers/overlayHost';
import { ENGLISH, HEBREW } from '@torahmap/shell/language.ts';
import { assertNamedEnds } from '../../helpers/assertions';

const data: TextAnalyticsData = {
  scores: {
    parameters: SAMPLE_TEXT_ANALYTICS_SCORES.parameters,
    repetition: { Genesis: { '1': [0, 0.5, null, 0.25] } },
    // Verse 1's fourth and fifth words, a maqaf pair.
    repeated: { Genesis: { '1': { '1': [3, 5] } } },
    // Verses 1 and 4 share a run.
    echoes: { Genesis: { '1': { '1': [3], '4': [-3] } } },
  },
  // Verses 1 and 4 share a run of five words, and 2 and 3 one of seven.
  echoes: { 0: [3, 5], 1: [2, 7] },
  texts: {
    Genesis: {
      '1': Object.fromEntries(
        // Eight words as the measure counts them: each maqaf pair as two, the written-and-read
        // pair as one. Counting by spaces (7), by maqaf groups (6) or with both spellings (9)
        // cannot give back a score of 25%.
        [1, 2, 3, 4].map((v) => [v, { he: 'אבג־דהו (זחט) [יכל] מנס־עפצ קרש תאב שין', en: '' }]),
      ),
    },
  },
};

const verse = (n: number) => createVerse({ book: 'Genesis', chapter: 1, verse: n });

function host() {
  return hostOverlay(textAnalyticsOverlay, data);
}

const wording = { analysis: 'repetitive-wording' as const, words: 5 };
const echoSettings = { analysis: 'echoes' as const, words: 5 };

describe('Text Analytics overlay', () => {
  it('marks the repeated words of a verse, in its Hebrew text only', () => {
    const text = data.texts!.Genesis['1'][1].he;
    const h = host();
    const marked = h.highlightItemText(verse(1), text, HEBREW);
    expect([...marked.querySelectorAll('mark')].map((m) => m.textContent)).toEqual(['מנס־עפצ']);
    expect(marked.textContent).toBe(text);
    expect(h.highlightItemText(verse(1), text, ENGLISH).querySelector('mark')).toBeNull();
    expect(h.highlightItemText(verse(2), text, HEBREW).querySelector('mark')).toBeNull();
  });

  it("keeps a focused verse and its echoes in the scale's colours and mutes the rest", () => {
    const items = [1, 2, 3, 4].map(verse);
    const settings = wording;
    const colors = textAnalyticsOverlay.colorsFor!({
      items,
      settings,
      data,
      focus: { hovered: verse(4), pinned: null },
    });
    expect(colors[0]).toEqual(host().getItemColor(verse(1)));
    expect(colors[3]).toEqual(host().getItemColor(verse(4)));
    // The verse at the top of the scale darkens; one without a score is left as it was.
    const sum = (color: number[]) => color[0] + color[1] + color[2];
    expect(sum(colors[1] as number[])).toBeLessThan(sum(host().getItemColor(verse(2)) as number[]));
    expect(colors[2]).toEqual(NO_DATA);
  });

  it("lists the focused verse's echoes in words, and nothing for a verse without any", () => {
    const say = (v: number) => {
      const panel = document.createElement('div');
      textAnalyticsOverlay.renderFocus!(panel, verse(v), null, wording, data, () => {});
      return panel.textContent;
    };
    expect(say(1)).toContain('Genesis 1:4');
    expect(say(2)).toBe('');
  });

  it('makes the focused verse and its echoes stand out, and nothing else', () => {
    const items = [1, 2, 3, 4].map(verse);
    const settings = wording;
    expect(
      textAnalyticsOverlay.standoutsFor!({
        items,
        settings,
        data,
        focus: { hovered: verse(1), pinned: null },
      }),
    ).toEqual([true, false, false, true]);
    expect(
      textAnalyticsOverlay.standoutsFor!({
        items,
        settings,
        data,
        focus: { hovered: verse(2), pinned: null },
      }),
    ).toEqual([false, false, false, false]);
  });

  it('travels to a parallel verse from its link in the panel', () => {
    const panel = document.createElement('div');
    const travelled: string[] = [];
    textAnalyticsOverlay.renderFocus!(panel, verse(1), null, wording, data, (id) =>
      travelled.push(id),
    );
    [...panel.querySelectorAll('button')]
      .find((b) => b.textContent!.includes('Genesis 1:4'))!
      .click();
    expect(travelled).toEqual([verse(4).id]);
  });

  it('lists the focused verse among its parallels, in canonical order', () => {
    const refs = (focus: number) => {
      const panel = document.createElement('div');
      textAnalyticsOverlay.renderFocus!(panel, verse(focus), null, wording, data, () => {});
      return [...panel.querySelectorAll('.parallel-ref')].map((ref) => ref.textContent);
    };
    expect(refs(1)).toEqual(['Genesis 1:1', 'Genesis 1:4']);
    expect(refs(4)).toEqual(['Genesis 1:1', 'Genesis 1:4']);
  });

  it('colours the map as usual when neither the hovered nor the pinned verse has echoes', () => {
    const items = [1, 2, 3, 4].map(verse);
    const settings = wording;
    const colors = textAnalyticsOverlay.colorsFor!({
      items,
      settings,
      data,
      focus: { hovered: verse(2), pinned: verse(3) },
    });
    expect(colors).toEqual(items.map((item) => host().getItemColor(item)));
  });

  it("shows a pinned verse's echoes until a hovered verse with echoes of its own takes over", () => {
    const items = [1, 2, 3, 4].map(verse);
    const settings = wording;
    const plain = items.map((item) => host().getItemColor(item));
    const pinOnly = textAnalyticsOverlay.colorsFor!({
      items,
      settings,
      data,
      focus: { hovered: null, pinned: verse(1) },
    });
    expect(pinOnly[1]).not.toEqual(plain[1]);
    // A hover on a verse with none leaves the pin's showing.
    expect(
      textAnalyticsOverlay.colorsFor!({
        items,
        settings,
        data,
        focus: { hovered: verse(2), pinned: verse(1) },
      }),
    ).toEqual(pinOnly);
    expect(
      textAnalyticsOverlay.standoutsFor!({
        items,
        settings,
        data,
        focus: { hovered: null, pinned: verse(1) },
      }),
    ).toEqual([true, false, false, true]);
  });

  it('repaints on a pin only when it starts or ends on a verse with echoes', () => {
    const { pinChangesColors } = textAnalyticsOverlay;
    const settings = wording;
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

  it('colours each verse by its score', () => {
    const h = host();
    expect(h.getItemColor(verse(1))).not.toEqual(h.getItemColor(verse(2)));
  });

  it('leaves a verse without a score, or outside the file, uncoloured', () => {
    const h = host();
    expect(h.getItemColor(verse(3))).toEqual(NO_DATA);
    expect(h.getItemColor(createVerse({ book: 'Exodus', chapter: 1, verse: 1 }))).toEqual(NO_DATA);
    expect(h.getHoverInfo(verse(3))).toBeNull();
  });

  it('gives the hover as a count of words that agrees with the score', () => {
    const [repeated, words] = host().getHoverInfo(verse(4))!.match(/\d+/g)!.map(Number);
    expect(repeated / words).toBe(0.25);
  });

  it('gives the hover as a share while the verse texts are still loading', () => {
    const h = hostOverlay(textAnalyticsOverlay, { ...data, texts: null });
    expect(h.getHoverInfo(verse(2))).toContain('50%');
  });

  it('names the ends of its strip in the legend card', () => {
    assertNamedEnds(host().summary());
  });

  it('always names its analysis in the link, and opens on it from a link that names none', () => {
    const h = host();
    expect(h.toUrl()).toEqual({ analysis: 'repetitive-wording' });
    expect(h.fromUrl({})).toEqual(h.fromUrl({ analysis: 'repetitive-wording' }));
  });

  describe('echoes across the Tanakh', () => {
    const items = [1, 2, 3, 4].map(verse);
    const colors = (
      echoes: TextAnalyticsData['echoes'],
      hovered: ReturnType<typeof verse> | null,
      words = 5,
    ) =>
      textAnalyticsOverlay.colorsFor!({
        items,
        settings: { ...echoSettings, words },
        data: {
          ...data,
          echoes,
        },
        focus: { hovered, pinned: null },
      });

    it('shows a verse without echoes in the map grey at 0.6 of its brightness', () => {
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
        textAnalyticsOverlay.renderFocus!(
          panel,
          verse(1),
          null,
          { ...echoSettings, words },
          data,
          () => {},
        );
        return panel.textContent;
      };
      expect(say(5)).toContain('Genesis 1:4');
      expect(say(6)).toBe('');
    });

    describe('by distance', () => {
      // In reading order: Genesis 1:1, Genesis 1:2, Genesis 2:1, Exodus 1:1, Isaiah 1:1, Psalms 1:1.
      initBookData({
        books: ['Genesis', 'Exodus', 'Isaiah', 'Psalms'].map((name, i) => ({
          name,
          hebrewName: '',
          section: (['torah', 'torah', 'neviim', 'ketuvim'] as const)[i],
          chapters: [2],
        })),
        layout: { minorProphetStacks: [], ketuvimStacks: [], multiColumnBooks: {} },
      });
      const places = [
        createVerse({ book: 'Genesis', chapter: 1, verse: 1 }),
        createVerse({ book: 'Genesis', chapter: 1, verse: 2 }),
        createVerse({ book: 'Genesis', chapter: 2, verse: 1 }),
        createVerse({ book: 'Exodus', chapter: 1, verse: 1 }),
        createVerse({ book: 'Isaiah', chapter: 1, verse: 1 }),
        createVerse({ book: 'Psalms', chapter: 1, verse: 1 }),
      ];
      const spread: TextAnalyticsData = {
        ...data,
        scores: {
          ...data.scores,
          repetition: {
            Genesis: { '1': [0, 0], '2': [0] },
            Exodus: { '1': [0] },
            Isaiah: { '1': [0] },
            Psalms: { '1': [0] },
          },
        },
      };
      const paint = (
        echoes: TextAnalyticsData['echoes'],
        hovered: (typeof places)[number] | null = null,
        pinned: (typeof places)[number] | null = null,
      ) =>
        textAnalyticsOverlay.colorsFor!({
          items: places,
          settings: echoSettings,
          data: { ...spread, echoes },
          focus: { hovered, pinned },
        });
      const [chapter, book, section, other] = DISTANCE_STEPS.map((step) => step.color);
      const light = (color: Color) => color[0] + color[1] + color[2];

      it('colours a verse by the distance of its farthest echo', () => {
        expect(paint({ 0: [1, 5] })[0]).toEqual(chapter);
        expect(paint({ 0: [1, 5, 2, 5] })[0]).toEqual(book);
        expect(paint({ 0: [1, 5, 2, 5, 3, 5] })[0]).toEqual(section);
        expect(paint({ 0: [1, 5, 2, 5, 3, 5, 4, 5, 5, 5] })[0]).toEqual(other);
      });

      it("leaves a focused verse's echoes the colour they have at rest, and the verse white", () => {
        const echoes = { 0: [1, 5, 2, 5, 3, 5, 4, 5, 5, 5], 1: [5, 5] };
        const colors = paint(echoes, places[0]);
        expect(colors[0]).toEqual([1, 1, 1]);
        expect(colors.slice(1)).toEqual(paint(echoes).slice(1));
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
    });

    describe('marking the shared phrase', () => {
      const he = (words: string[]) => ({ he: words.join(' '), en: '' });
      const marking: TextAnalyticsData = {
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
          marked(
            textAnalyticsOverlay.highlightItemText!(verse(1), text, HEBREW, echoSettings, marking),
          ),
        ).toEqual(['זחט יכל מנס עפצ קרש']);
        expect(
          marked(
            textAnalyticsOverlay.highlightItemText!(verse(1), text, ENGLISH, echoSettings, marking),
          ),
        ).toEqual([]);
        expect(
          marked(
            textAnalyticsOverlay.highlightItemText!(
              verse(1),
              text,
              HEBREW,
              { ...echoSettings, words: 6 },
              marking,
            ),
          ),
        ).toEqual([]);
      });

      it('marks the run each parallel in the list shares with the focused verse', () => {
        const panel = document.createElement('div');
        textAnalyticsOverlay.renderFocus!(panel, verse(1), null, echoSettings, marking, () => {});
        // Once in the focused verse, once in its parallel.
        expect([...panel.querySelectorAll('mark')].map((mark) => mark.textContent)).toEqual([
          'זחט יכל מנס עפצ קרש',
          'זחט יכל מנס עפצ קרש',
        ]);
      });
    });

    it('names the words in a row in the link for this analysis only', () => {
      const h = host();
      expect(h.fromUrl({ analysis: 'echoes', words: '7' })).toEqual({
        analysis: 'echoes',
        words: 7,
      });
      expect(textAnalyticsOverlay.settingsToUrl!({ ...echoSettings, words: 7 })).toEqual({
        analysis: 'echoes',
        words: '7',
      });
      expect(textAnalyticsOverlay.settingsToUrl!(wording)).toEqual({
        analysis: 'repetitive-wording',
      });
    });

    it('draws the words slider only for this analysis, and reports a move of it', () => {
      const h = host();
      h.restore({ analysis: 'echoes' });
      const slider = h.renderControls().querySelector('input')!;
      expect(slider.closest('label')!.hidden).toBe(false);
      slider.value = '8';
      slider.dispatchEvent(new Event('input'));
      expect(h.settings).toEqual({ analysis: 'echoes', words: 8 });
      h.restore({ analysis: 'repetitive-wording' });
      expect(h.renderControls().querySelector('label')!.hidden).toBe(true);
    });
  });
});
