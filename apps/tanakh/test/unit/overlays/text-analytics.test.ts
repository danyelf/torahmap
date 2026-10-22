import { describe, it, expect } from 'vitest';
import { textAnalyticsOverlay, type TextAnalyticsData } from '../../../src/overlays/text-analytics';
import { NO_DATA } from '../../../src/overlays/colors';
import { createVerse, SAMPLE_TEXT_ANALYTICS_SCORES } from '../../helpers/fixtures';
import { hostOverlay } from '../../helpers/overlayHost';

const data: TextAnalyticsData = {
  scores: {
    parameters: { ...SAMPLE_TEXT_ANALYTICS_SCORES.parameters },
    repetition: { Genesis: { '1': [0, 0.5, null, 0.25] } },
    division: { Genesis: { '1': [0.2, -0.2, null, 0] } },
  },
};

const verse = (n: number) => createVerse({ book: 'Genesis', chapter: 1, verse: n });

function host() {
  return hostOverlay(textAnalyticsOverlay, data);
}

describe('Text analytics overlay', () => {
  it('starts on repetitive wording, and a link can choose verse division', () => {
    const h = host();
    expect(h.settings.measure).toBe('repetition');
    h.restore({ measure: 'division' });
    expect(h.settings.measure).toBe('division');
    expect(h.toUrl()).toEqual({ measure: 'division' });
  });

  it('colours each verse by the chosen measure', () => {
    const h = host();
    const repetition = [1, 2].map((n) => h.getItemColor(verse(n)));
    h.change((s) => ({ ...s, measure: 'division' }));
    const division = [1, 2].map((n) => h.getItemColor(verse(n)));
    expect(repetition[0]).not.toEqual(repetition[1]);
    // The two measures rank these verses in opposite orders.
    expect(division[0]).toEqual(repetition[1]);
    expect(division[1]).toEqual(repetition[0]);
  });

  it('leaves a verse without a score, or outside the file, uncoloured', () => {
    const h = host();
    expect(h.getItemColor(verse(3))).toEqual(NO_DATA);
    expect(h.getItemColor(createVerse({ book: 'Exodus', chapter: 1, verse: 1 }))).toEqual(NO_DATA);
    expect(h.getHoverInfo(verse(3))).toBeNull();
  });

  it('switches measure from its controls', () => {
    const h = host();
    const controls = h.renderControls();
    controls.querySelector<HTMLButtonElement>('[data-measure="division"]')!.click();
    expect(h.settings.measure).toBe('division');
    expect(controls.querySelector('[data-measure="division"]')!.getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
});
