import { describe, it, expect } from 'vitest';
import { firstSentence } from '@torahmap/stories';

describe('firstSentence', () => {
  it("is a stop's first sentence, without markup", () => {
    const text =
      'Five chapters later, God renames him: *no longer Abram, but **Abraham**.*\n\nAdd the new name.';
    expect(firstSentence({ text })).toBe(
      'Five chapters later, God renames him: no longer Abram, but Abraham.',
    );
  });

  it('ends a sentence inside a closing quote', () => {
    const text = 'God gives Abram a new name: “your name shall be Abraham.” We can add it.';
    expect(firstSentence({ text })).toBe(
      'God gives Abram a new name: “your name shall be Abraham.”',
    );
  });

  it('is the whole text when it has no sentence end', () => {
    expect(firstSentence({ text: 'Search for [Abram](https://example.org)' })).toBe(
      'Search for Abram',
    );
  });

  it('drops tags', () => {
    expect(firstSentence({ text: 'The <span class="x">red</span> verses. More.' })).toBe(
      'The red verses.',
    );
  });

  it('is undefined for a stop with no text', () => {
    expect(firstSentence({ text: '' })).toBeUndefined();
  });
});
