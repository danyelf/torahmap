// The list of matching items under the search panel.
//
// Told what to show on every pass, so it holds no opinion about what the search
// found — only how far down its own list it has drawn.
import { colorToCss } from '@torahmap/utils';
import type { SearchResult, Snippet } from './textIndex.ts';
import { SEARCH_COLORS, colorIndexAt, type SearchTerm } from './terms.ts';
import { markRange } from './highlight.ts';

/** Everything one pass of the list needs to know. */
export interface ResultsView {
  /** The items to list, already narrowed to the row being asked about. */
  results: SearchResult[];
  /** The terms being searched, in search order: a match names its term by position here. */
  terms: SearchTerm[];
  /** Which of those terms the list is answering about, or -1 when the open row searches nothing. */
  focus: number;
  onSelect(result: SearchResult): void;
  /** A result's text quoted around `term`, or null for an item the index lacks. */
  snippet(result: SearchResult, term: SearchTerm): Snippet | null;
  /** Whether `term`'s quotations are written right to left. */
  rtl(term: SearchTerm): boolean;
}

const RESULTS_BATCH_SIZE = 50;

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
  refDiv.appendChild(document.createTextNode(result.ref));

  // The snippet quotes the word the list is answering about, else whichever
  // term claimed the item first.
  const firstMatch =
    result.matchingTerms.find((m) => m.termIndex === view.focus) ?? result.matchingTerms[0];

  const term = view.terms[firstMatch.termIndex];
  const snippetDiv = document.createElement('div');
  snippetDiv.className = `snippet ${term && view.rtl(term) ? 'rtl' : ''}`;

  const { snippet, matchStart, matchEnd } = (term && view.snippet(result, term)) ?? {
    snippet: result.ref,
    matchStart: 0,
    matchEnd: 0,
  };

  snippetDiv.appendChild(
    markRange(snippet, matchStart, matchEnd, colorIndexAt(view.terms, firstMatch.termIndex)),
  );

  div.appendChild(refDiv);
  div.appendChild(snippetDiv);

  div.addEventListener('click', () => view.onSelect(result));

  return div;
}

export interface ResultsList {
  /** Draw the list from the top, a batch at a time as the reader scrolls. */
  render(container: HTMLDivElement, view: ResultsView): void;
  /** Quote the rows already drawn again with `snippet`, in place and without scrolling. */
  requote(container: HTMLDivElement, snippet: ResultsView['snippet']): void;
  /** Stop listening for scrolls, for a container about to be thrown away. */
  detach(container: HTMLDivElement | null): void;
}

export function createResultsList(): ResultsList {
  // How far down the current list we have drawn, and what it is a list of, so a
  // scroll can carry on where the last batch stopped.
  let shown: ResultsView | null = null;
  let renderedCount = 0;
  let scrollHandler: (() => void) | null = null;

  function appendResultsBatch(container: HTMLDivElement): void {
    if (!shown || renderedCount >= shown.results.length) return;

    const end = Math.min(renderedCount + RESULTS_BATCH_SIZE, shown.results.length);
    for (let i = renderedCount; i < end; i++) {
      container.appendChild(createResultElement(shown.results[i], shown));
    }
    renderedCount = end;
  }

  function render(container: HTMLDivElement, view: ResultsView): void {
    shown = view;

    container.querySelectorAll('.search-result').forEach((el) => el.remove());
    renderedCount = 0;
    container.scrollTop = 0;

    detach(container);

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

  function requote(container: HTMLDivElement, snippet: ResultsView['snippet']): void {
    if (!shown) return;
    const view = (shown = { ...shown, snippet });
    container.querySelectorAll('.search-result').forEach((row, i) => {
      row.replaceWith(createResultElement(view.results[i], view));
    });
  }

  function detach(container: HTMLDivElement | null): void {
    if (scrollHandler && container) {
      container.removeEventListener('scroll', scrollHandler);
    }
    scrollHandler = null;
  }

  return { render, requote, detach };
}
