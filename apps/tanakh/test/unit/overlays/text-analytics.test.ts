import { describe, it, expect } from 'vitest';
import { textAnalyticsOverlay, type TextAnalyticsData } from '../../../src/overlays/text-analytics';
import { NO_DATA } from '../../../src/overlays/colors';
import { createVerse } from '../../helpers/fixtures';
import { hostOverlay } from '../../helpers/overlayHost';

const data: TextAnalyticsData = {
  scores: {
    parameters: { windowVerses: 11, minWords: 7, runWords: 3, reachVerses: 50 },
    repetition: { Genesis: { '1': [0, 0.5, null, 0.25] } },
    trop: { Genesis: { '1': [0.2, -0.2, null, 0] } },
  },
};

const verse = (n: number) => createVerse({ book: 'Genesis', chapter: 1, verse: n });

function host() {
  return hostOverlay(textAnalyticsOverlay, data);
}

describe('Text analytics overlay', () => {
  it('starts on repetitive wording, and a link can choose rare trop', () => {
    const h = host();
    expect(h.settings.measure).toBe('repetition');
    h.restore({ measure: 'trop' });
    expect(h.settings.measure).toBe('trop');
    expect(h.toUrl()).toEqual({ measure: 'trop' });
  });

  it('colours each verse by the chosen measure', () => {
    const h = host();
    const repetition = [1, 2].map((n) => h.getItemColor(verse(n)));
    h.change((s) => ({ ...s, measure: 'trop' }));
    const trop = [1, 2].map((n) => h.getItemColor(verse(n)));
    expect(repetition[0]).not.toEqual(repetition[1]);
    // The two measures rank these verses in opposite orders.
    expect(trop[0]).toEqual(repetition[1]);
    expect(trop[1]).toEqual(repetition[0]);
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
    controls.querySelector<HTMLButtonElement>('[data-measure="trop"]')!.click();
    expect(h.settings.measure).toBe('trop');
    expect(controls.querySelector('[data-measure="trop"]')!.getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
});
