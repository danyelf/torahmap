import { describe, it, expect } from 'vitest';
import { commentaryOverlay, configure } from '../../../overlays/commentary';
import { ready } from '../../../dataLoading';
import { createVerse } from '../../helpers/fixtures';

const verses = [
  createVerse({ book: 'Genesis', chapter: 1, verse: 1 }),
  createVerse({ book: 'Genesis', chapter: 12, verse: 1 }),
  createVerse({ book: 'Genesis', chapter: 36, verse: 20 }),
  createVerse({ book: 'Numbers', chapter: 7, verse: 30 }),
];
const settings = { category: 'total' };

describe('commentary drawn before its data arrives', () => {
  it('shades verses apart once the data is in', async () => {
    configure({ verses });
    commentaryOverlay.renderLegend!(document.createElement('div'), settings);

    await ready(commentaryOverlay);

    const colors = commentaryOverlay.colorsFor!(verses, settings, null);
    expect(new Set(colors.map((c) => JSON.stringify(c))).size).toBeGreaterThan(1);
  });
});
