import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HEBREW_LABEL_FONT } from '../../constants/labels';

// The label code names a font family; the HTML is what makes that name resolve
// to a real face. They live in different files, so a typeface change can update
// one and leave the other pointing at a font nothing asks for any more — the
// labels then fall back to a system face and still take HEBREW_LABEL_SCALE,
// which is measured for the face that failed to load.
const ENTRY_POINTS = ['index.html', 'talmud.html'];

const familyName = HEBREW_LABEL_FONT.split(',')[0].replace(/"/g, '').trim();

describe('map label typography', () => {
  it.each(ENTRY_POINTS)('%s requests the family the labels are set in', (entry) => {
    const html = readFileSync(join(process.cwd(), entry), 'utf8');
    const requested = [...html.matchAll(/fonts\.googleapis\.com\/css2\?family=([^:&"]+)/g)].map(
      (m) => decodeURIComponent(m[1]).replace(/\+/g, ' '),
    );

    expect(requested).toContain(familyName);
  });
});
