import { describe, expect, it } from 'vitest';
import { euaiactText } from '../src/text.ts';
import { STRUCTURE_FILE, TEXTS_FILE } from '../src/data.ts';
import { actFixture } from './helpers/actFixture.ts';

const open = euaiactText.open(new Map([[STRUCTURE_FILE, actFixture]]));
const item = (id: string) => open.items.find((i) => i.id === id)!;

describe('the Act as a text', () => {
  it('shows a square’s text, in English, with a link to its source', () => {
    const texts = new Map<string, unknown>([[TEXTS_FILE, { '1(1)': 'The purpose is…' }]]);
    const popup = open.popupText(item('1(1)'), texts, null);
    expect(popup.hebrew).toBe('');
    expect(popup.english).toBe('The purpose is…');
    expect(popup.link).toContain('#art_1');
    expect(popup.ref).toBe('Article 1(1)');
  });

  it('shows no text before the texts file is in', () => {
    expect(open.popupText(item('1(1)'), new Map(), null).english).toBe('');
  });

  it('has a story to open on', () => {
    expect(open.stories.list.length).toBeGreaterThan(0);
  });

  it('has no Hebrew', () => {
    expect(euaiactText.site.hasHebrew).toBe(false);
  });
});
