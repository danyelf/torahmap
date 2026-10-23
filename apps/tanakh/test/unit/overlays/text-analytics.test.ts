import { describe, it, expect } from 'vitest';
import { textAnalyticsOverlay, type TextAnalyticsData } from '../../../src/overlays/text-analytics';
import { NO_DATA } from '../../../src/overlays/colors';
import { createVerse, SAMPLE_TEXT_ANALYTICS_SCORES } from '../../helpers/fixtures';
import { hostOverlay } from '../../helpers/overlayHost';
import { assertNamedEnds } from '../../helpers/assertions';

const data: TextAnalyticsData = {
  scores: {
    parameters: { ...SAMPLE_TEXT_ANALYTICS_SCORES.parameters },
    repetition: { Genesis: { '1': [0, 0.5, null, 0.25] } },
  },
};

const verse = (n: number) => createVerse({ book: 'Genesis', chapter: 1, verse: n });

function host() {
  return hostOverlay(textAnalyticsOverlay, data);
}

describe('Text analytics overlay', () => {
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

  it('offers no choice of measure while it has only one', () => {
    expect(host().renderControls().querySelector('[data-measure]')).toBeNull();
  });

  it('names the ends of its strip in the legend card', () => {
    assertNamedEnds(host().summary());
  });
});
