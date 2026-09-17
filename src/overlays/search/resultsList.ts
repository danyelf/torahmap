// The list of matching verses under the search panel.
//
// Told what to show on every pass, so it holds no opinion about what the search
// found — only how far down its own list it has drawn.
import type { SearchResult } from '../../search.ts';
import { computeSnippetForMatch } from '../../search.ts';
import { colorIndexAt, type SearchTerm } from '../../search/terms.ts';
import { SEARCH_COLORS, colorToCss } from '../../utils/color.ts';
import { markRange } from './highlight.ts';

/** Everything one pass of the list needs to know. */
export interface ResultsView {
  /** The verses to list, already narrowed to the row being asked about. */
  results: SearchResult[];
  /** The terms being searched, in search order: a match names its term by position here. */
  terms: SearchTerm[];
  /** Which of those terms the list is answering about, or -1 when the open row searches nothing. */
  focus: number;
  onSelect(result: SearchResult): void;
}

const RESULTS_BATCH_SIZE = 50;

// How far down the current list we have drawn, and what it is a list of, so a
// scroll can carry on where the last batch stopped.
let shown: ResultsView | null = null;
let renderedCount = 0;
let scrollHandler: (() => void) | null = null;

function createResultElement(result: SearchResult, view: ResultsView): HTMLDivElement {
  const div = document.createElement('div');
  div.className = 'search-result';

  const refDiv = document.createElement('div');
  refDiv.className = 'ref';

  const termIndicators = document.createElement('span');
  termIndicators.className = 'term-indicators';
  for (const m of result.matchingTerms) {
    const dot = document.createElement('span');
    dot.className = 'term-dot';
    dot.style.background = colorToCss(SEARCH_COLORS[colorIndexAt(view.terms, m.termIndex)]);
    termIndicators.appendChild(dot);
  }
  refDiv.appendChild(termIndicators);
  refDiv.appendChild(document.createTextNode(`${result.book} ${result.chapter}:${result.verse}`));

  // The snippet is drawn for the word the list is answering about, falling back
  // to whichever term claimed the verse first. Without this, a list narrowed to
  // the second word would quote the first word's match — the reader would have
  // asked about one word and been shown another.
  const firstMatch =
    result.matchingTerms.find((m) => m.termIndex === view.focus) ?? result.matchingTerms[0];

  const snippetDiv = document.createElement('div');
  snippetDiv.className = `snippet ${result.language === 'he' ? 'rtl' : ''}`;

  // Computed on demand: meanings mode leaves these unset until the result is shown.
  let snippet = firstMatch.snippet;
  let matchStart = firstMatch.matchStart;
  let matchEnd = firstMatch.matchEnd;

  if (snippet === undefined || matchStart === undefined || matchEnd === undefined) {
    const snippetData = computeSnippetForMatch(
      result,
      firstMatch.termIndex,
      view.terms[firstMatch.termIndex]?.text ?? '',
    );
    if (snippetData) {
      snippet = snippetData.snippet;
      matchStart = snippetData.matchStart;
      matchEnd = snippetData.matchEnd;
    } else {
      snippet = `${result.book} ${result.chapter}:${result.verse}`;
      matchStart = 0;
      matchEnd = 0;
    }
  }

  snippetDiv.appendChild(
    markRange(snippet, matchStart, matchEnd, colorIndexAt(view.terms, firstMatch.termIndex)),
  );

  div.appendChild(refDiv);
  div.appendChild(snippetDiv);

  div.addEventListener('click', () => view.onSelect(result));

  return div;
}

function appendResultsBatch(container: HTMLDivElement): void {
  if (!shown || renderedCount >= shown.results.length) return;

  const end = Math.min(renderedCount + RESULTS_BATCH_SIZE, shown.results.length);
  for (let i = renderedCount; i < end; i++) {
    container.appendChild(createResultElement(shown.results[i], shown));
  }
  renderedCount = end;
}

/** Draw the list from the top, a batch at a time as the reader scrolls. */
export function renderResults(container: HTMLDivElement, view: ResultsView): void {
  shown = view;

  container.querySelectorAll('.search-result').forEach((el) => el.remove());
  renderedCount = 0;
  container.scrollTop = 0;

  detachResults(container);

  if (view.results.length === 0) {
    container.classList.remove('visible');
    return;
  }

  appendResultsBatch(container);

  if (renderedCount < view.results.length) {
    scrollHandler = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // Load more within 100px of the bottom.
      if (scrollHeight - scrollTop - clientHeight < 100) {
        appendResultsBatch(container);
      }
    };
    container.addEventListener('scroll', scrollHandler);
  }

  container.classList.add('visible');
}

/** Stop listening for scrolls, for a container about to be thrown away. */
export function detachResults(container: HTMLDivElement | null): void {
  if (scrollHandler && container) {
    container.removeEventListener('scroll', scrollHandler);
  }
  scrollHandler = null;
}
