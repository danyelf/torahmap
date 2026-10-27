import { describe, it, expect } from 'vitest';
import { textAnalyticsOverlay, type TextAnalyticsData } from '../../../src/overlays/text-analytics';
import { NO_DATA } from '../../../src/overlays/colors';
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
    const settings = { analysis: 'repetitive-wording' as const };
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
      textAnalyticsOverlay.renderFocus!(
        panel,
        verse(v),
        { analysis: 'repetitive-wording' },
        data,
        () => {},
      );
      return panel.textContent;
    };
    expect(say(1)).toContain('Genesis 1:4');
    expect(say(2)).toBe('');
  });

  it('makes the focused verse and its echoes stand out, and nothing else', () => {
    const items = [1, 2, 3, 4].map(verse);
    const settings = { analysis: 'repetitive-wording' as const };
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
    textAnalyticsOverlay.renderFocus!(
      panel,
      verse(1),
      { analysis: 'repetitive-wording' },
      data,
      (id) => travelled.push(id),
    );
    panel.querySelector('a')!.click();
    expect(travelled).toEqual([verse(4).id]);
  });

  it('colours the map as usual when the hovered verse has no echoes', () => {
    const items = [1, 2, 3, 4].map(verse);
    const settings = { analysis: 'repetitive-wording' as const };
    const colors = textAnalyticsOverlay.colorsFor!(items, settings, verse(2), data);
    expect(colors).toEqual(items.map((item) => host().getItemColor(item)));
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
});
