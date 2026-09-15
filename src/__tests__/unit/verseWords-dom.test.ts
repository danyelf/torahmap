// Word spans and overlay highlighting in the same text.
//
// The verse popup may hold plain text, search highlights, or trop highlights.
// Words have to become clickable in all three without changing what the
// overlays produce.

import { describe, it, expect } from 'vitest';
import { splitVerseText, wrapWordsInFragment } from '../../verseWords';

function fragmentOf(...nodes: Node[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const node of nodes) fragment.appendChild(node);
  return fragment;
}

function mark(text: string): HTMLElement {
  const element = document.createElement('mark');
  element.textContent = text;
  return element;
}

describe('wrapping words in a highlighted fragment', () => {
  it('gives each word its own span', () => {
    const text = 'בראשית ברא אלהים';
    const wrapped = wrapWordsInFragment(fragmentOf(document.createTextNode(text)), text);

    const spans = [...wrapped.querySelectorAll('.verse-word')];
    expect(spans.map((s) => s.textContent)).toEqual(['בראשית', 'ברא', 'אלהים']);
    expect(spans.map((s) => s.getAttribute('data-word-index'))).toEqual(['0', '1', '2']);
  });

  it('leaves the text itself unchanged', () => {
    const text = 'עַל־פְּנֵי תְה֑וֹם׃ {פ}';
    const wrapped = wrapWordsInFragment(fragmentOf(document.createTextNode(text)), text);

    expect(wrapped.textContent).toBe(text);
  });

  it('does not make a paragraph marker clickable', () => {
    const text = 'אֶחָֽד׃ {פ}';
    const wrapped = wrapWordsInFragment(fragmentOf(document.createTextNode(text)), text);

    const spans = [...wrapped.querySelectorAll('.verse-word')];
    expect(spans.map((s) => s.textContent)).toEqual(['אֶחָֽד']);
  });

  it('keeps a highlight that covers a whole word', () => {
    // Search highlighting a matched word: the mark survives and the word is
    // still one clickable span.
    const text = 'ברא אלהים';
    const wrapped = wrapWordsInFragment(
      fragmentOf(mark('ברא'), document.createTextNode(' אלהים')),
      text,
    );

    expect(wrapped.querySelector('mark')).not.toBeNull();
    expect(wrapped.textContent).toBe(text);
    expect([...wrapped.querySelectorAll('.verse-word')].length).toBeGreaterThanOrEqual(2);
  });

  it('gives both halves of an interrupted word the same index', () => {
    // Trop marks a single accent inside a word, so the word arrives as three
    // nodes. A click on either half must still mean one word.
    const text = 'ברא אלהים';
    const wrapped = wrapWordsInFragment(
      fragmentOf(document.createTextNode('ב'), mark('ר'), document.createTextNode('א אלהים')),
      text,
    );

    const first = [...wrapped.querySelectorAll('[data-word-index="0"]')];
    expect(first.map((s) => s.textContent).join('')).toBe('ברא');
    expect(wrapped.textContent).toBe(text);
  });
});
