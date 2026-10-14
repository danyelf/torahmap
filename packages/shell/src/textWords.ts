// Splitting an item's displayed text into the words a reader can click.
//
// Where a word ends is decided in hebrew.ts, which is also what the
// dictionary index was built on. A click resolving a different word than
// search would find is the failure this shares a rule to avoid.

import { isSearchableWord, splitIntoWords, type TextWord } from './hebrew.ts';
import { TEXT_LINK } from './textLinks.ts';
import { wrapRuns } from './textRuns.ts';

/** {פ} and {ס}: paragraph markers Sefaria leaves in the text. Not words. */
const SECTION_MARKER = /^\{[פס]\}$/;

export function isSectionMarker(word: string): boolean {
  return SECTION_MARKER.test(word);
}

/**
 * The words of an item's text a reader can click, in order. A word's position in
 * this list is its index: what a click reports and the parse is looked up by.
 */
export function textWords(text: string): TextWord[] {
  return splitIntoWords(text).filter(
    ({ word }) => !isSectionMarker(word) && isSearchableWord(word),
  );
}

/**
 * Make every word in an already-built fragment clickable.
 *
 * Text inside a link is left as it is: a click there follows the link.
 *
 * A word broken up by a mark becomes more than one span. They share a word
 * index, which is why the index is what a click reads rather than the span's
 * own text: one word, one answer, however many pieces it arrived in.
 */
export function wrapWordsInFragment(fragment: DocumentFragment, text: string): DocumentFragment {
  const words = textWords(text);

  // Which word covers a given offset, or null between words. Offsets are
  // visited in increasing order as the walk proceeds, so the search can pick
  // up from the last word it found instead of scanning from the start every
  // time.
  let searchFrom = 0;
  const wordAt = (offset: number): number | null => {
    while (searchFrom > 0 && words[searchFrom - 1].end > offset) searchFrom--;
    while (searchFrom < words.length && words[searchFrom].end <= offset) searchFrom++;
    const word = words[searchFrom];
    return word && offset >= word.start && offset < word.end ? searchFrom : null;
  };

  return wrapRuns(
    fragment,
    text,
    wordAt,
    (index, run) => {
      const span = document.createElement('span');
      span.className = 'popup-word';
      span.dataset.wordIndex = String(index);
      span.textContent = run;
      return span;
    },
    (element) => element.classList.contains(TEXT_LINK),
  );
}
