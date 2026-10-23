import { describe, it, expect } from 'vitest';
import { textAnalyticsOverlay, type TextAnalyticsData } from '../../../src/overlays/text-analytics';
import { NO_DATA } from '../../../src/overlays/colors';
import { createVerse, SAMPLE_TEXT_ANALYTICS_SCORES } from '../../helpers/fixtures';
import { hostOverlay } from '../../helpers/overlayHost';
import { assertNamedEnds } from '../../helpers/assertions';

const data: TextAnalyticsData = {
  scores: {
    parameters: SAMPLE_TEXT_ANALYTICS_SCORES.parameters,
    repetition: { Genesis: { '1': [0, 0.5, null, 0.25] } },
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
