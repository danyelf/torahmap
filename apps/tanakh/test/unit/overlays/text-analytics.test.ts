import { describe, it, expect } from 'vitest';
import { textAnalyticsOverlay, type TextAnalyticsData } from '../../../src/overlays/text-analytics';
import { NO_DATA } from '../../../src/overlays/colors';
import { DIMMED_GREY } from '@torahmap/shell/constants.ts';
import { createVerse, SAMPLE_TEXT_ANALYTICS_SCORES } from '../../helpers/fixtures';
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
    const colors = textAnalyticsOverlay.colorsFor!(items, settings, verse(4), data);
    expect(colors[0]).toEqual(host().getItemColor(verse(1)));
    expect(colors[3]).toEqual(host().getItemColor(verse(4)));
    // The verse at the top of the scale turns red; one without a score is left as it was.
    const top = colors[1] as number[];
    expect(top).not.toEqual(host().getItemColor(verse(2)));
    expect(top[0]).toBeGreaterThan(top[2]);
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
    expect(textAnalyticsOverlay.standoutsFor!(items, settings, data, verse(1))).toEqual([
      true,
      false,
      false,
      true,
    ]);
    expect(textAnalyticsOverlay.standoutsFor!(items, settings, data, verse(2))).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it('travels to a parallel verse from its link in the panel', () => {
    const panel = document.createElement('div');
    const travelled: string[] = [];
    textAnalyticsOverlay.renderFocus!(panel, verse(1), null, wording, data, (id) =>
      travelled.push(id),
    );
    panel.querySelector('button')!.click();
    expect(travelled).toEqual([verse(4).id]);
  });

  it('colours the map as usual when neither the hovered nor the pinned verse has echoes', () => {
    const items = [1, 2, 3, 4].map(verse);
    const settings = wording;
    const colors = textAnalyticsOverlay.colorsFor!(items, settings, verse(2), data, verse(3));
    expect(colors).toEqual(items.map((item) => host().getItemColor(item)));
  });

  it("shows a pinned verse's echoes until a hovered verse with echoes of its own takes over", () => {
    const items = [1, 2, 3, 4].map(verse);
    const settings = wording;
    const plain = items.map((item) => host().getItemColor(item));
    const pinOnly = textAnalyticsOverlay.colorsFor!(items, settings, null, data, verse(1));
    expect(pinOnly[1]).not.toEqual(plain[1]);
    // A hover on a verse with none leaves the pin's showing.
    expect(textAnalyticsOverlay.colorsFor!(items, settings, verse(2), data, verse(1))).toEqual(
      pinOnly,
    );
    expect(textAnalyticsOverlay.standoutsFor!(items, settings, data, null, verse(1))).toEqual([
      true,
      false,
      false,
      true,
    ]);
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
      textAnalyticsOverlay.colorsFor!(items, { ...echoSettings, words }, hovered, {
        ...data,
        echoes,
      });

    it("colours a verse with echoes and leaves one without in the map's grey", () => {
      const [first, second] = colors({ 0: [3, 5] }, null);
      expect(first).not.toBeNull();
      expect(second).toBeNull();
      expect(colors({}, null)[0]).toBeNull();
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

    it('dims the verses outside the focus: greys to the dimmed grey, colours toward it', () => {
      const echoes = { 0: [3, 5], 1: [2, 7], 2: [3, 5] };
      const plain = colors(echoes, null);
      const lit = colors(echoes, verse(1));
      expect(lit[0]).toEqual(plain[0]);
      expect(lit[3]).toEqual(plain[3]);
      expect(lit[1]).not.toEqual(plain[1]);
      expect(lit[1]).not.toEqual(DIMMED_GREY);
      expect(colors({ 0: [3, 5] }, verse(1))[1]).toEqual(DIMMED_GREY);
    });

    it('does not mark words of the verse text', () => {
      const text = data.texts!.Genesis['1'][1].he;
      const marked = textAnalyticsOverlay.highlightItemText!(
        verse(1),
        text,
        HEBREW,
        echoSettings,
        data,
      );
      expect(marked.querySelector('mark')).toBeNull();
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

    describe('the colour wheel', () => {
      // The map is 1000 units square, so the wheel's centre is at about (503, 508).
      const anchor = createVerse({ book: 'Exodus', chapter: 1, verse: 1, x: 994, y: 994 });
      const partnerAt = (x: number, y: number) => [
        createVerse({ verse: 1, x: 0, y: 0 }),
        createVerse({ verse: 2, x: 50, y: 0 }),
        createVerse({ verse: 3, x: 50, y: 50 }),
        createVerse({ verse: 4, x: x - 3, y: y - 3 }),
        anchor,
      ];
      const colourOfFirst = (x: number, y: number) =>
        textAnalyticsOverlay.colorsFor!(partnerAt(x, y), echoSettings, null, {
          ...data,
          echoes: { 0: [3, 5] },
        })[0];

      it('colours a verse by the direction of its farthest echo from the centre, not the distance', () => {
        expect(colourOfFirst(603, 408)).toEqual(colourOfFirst(653, 358));
        expect(colourOfFirst(603, 408)).not.toEqual(colourOfFirst(403, 408));
      });

      it('colours a verse by the place of its farthest echo in reading order', () => {
        const items = partnerAt(603, 408);
        const first = (echoes: TextAnalyticsData['echoes']) =>
          textAnalyticsOverlay.colorsFor!(items, echoSettings, null, { ...data, echoes })[0];
        // Verse 2 lies at the left of the centre, verse 4 at the upper right; 4 is the farther.
        expect(first({ 0: [1, 5, 3, 5] })).toEqual(first({ 0: [3, 5] }));
        expect(first({ 0: [1, 5, 3, 5] })).not.toEqual(first({ 0: [1, 5] }));
      });

      it('draws a field behind the squares for this analysis only', () => {
        const items = partnerAt(603, 408);
        const field = textAnalyticsOverlay.backdrop!(items, echoSettings, data)!;
        expect(field.stops).toHaveLength(360);
        expect(field.rect.minX).toBeLessThan(0);
        expect(field.rect.maxX).toBeGreaterThan(1000);
        expect(field.centre.x).toBeGreaterThan(450);
        expect(field.centre.x).toBeLessThan(550);
        expect(textAnalyticsOverlay.backdrop!(items, wording, data)).toBeNull();
      });
    });
  });
});
