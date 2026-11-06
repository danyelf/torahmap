// A list of rows under a panel, drawn a batch at a time as the reader scrolls: search's matches,
// or any other items an overlay lists.
import { colorToCss, type Color } from '@torahmap/utils';
import { PALETTE } from '@torahmap/shell/overlays/palette.ts';
import type { SearchResult, Snippet } from './textIndex.ts';
import { colorIndexAt, type SearchTerm } from './terms.ts';
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

/** One row of a results list: a dot per colour it is found under, its name, and a line below. */
export interface ResultRow {
  colors: readonly Color[];
  /** Places in `colors` drawn as an outline, not filled. */
  hollow?: ReadonlySet<number>;
  ref: string;
  snippet: Node;
  rtl?: boolean;
  onSelect(): void;
}

export function resultRow(row: ResultRow): HTMLDivElement {
  const div = document.createElement('div');
  div.className = 'search-result';

  const refDiv = document.createElement('div');
  refDiv.className = 'ref';

  const termIndicators = document.createElement('span');
  termIndicators.className = 'term-indicators';
  row.colors.forEach((color, i) => {
    const dot = document.createElement('span');
    dot.className = 'term-dot';
    if (row.hollow?.has(i)) dot.style.boxShadow = `inset 0 0 0 1.5px ${colorToCss(color)}`;
    else dot.style.background = colorToCss(color);
    termIndicators.appendChild(dot);
  });
  refDiv.appendChild(termIndicators);
  refDiv.appendChild(document.createTextNode(row.ref));

  const snippetDiv = document.createElement('div');
  snippetDiv.className = `snippet ${row.rtl ? 'rtl' : ''}`;
  snippetDiv.appendChild(row.snippet);

  div.appendChild(refDiv);
  div.appendChild(snippetDiv);

  div.addEventListener('click', row.onSelect);

  return div;
}

/** The row of a search match, quoting the word the list is answering about. */
export function searchRow(view: ResultsView): (result: SearchResult) => ResultRow {
  return (result) => {
    // The snippet quotes the word the list is answering about, else whichever
    // term claimed the item first.
    const firstMatch =
      result.matchingTerms.find((m) => m.termIndex === view.focus) ?? result.matchingTerms[0];

    const term = view.terms[firstMatch.termIndex];
    const { snippet, matchStart, matchEnd } = (term && view.snippet(result, term)) ?? {
      snippet: result.ref,
      matchStart: 0,
      matchEnd: 0,
    };

    return {
      colors: result.matchingTerms.map((m) => PALETTE[colorIndexAt(view.terms, m.termIndex)]),
      ref: result.ref,
      snippet: markRange(
        snippet,
        matchStart,
        matchEnd,
        colorIndexAt(view.terms, firstMatch.termIndex),
      ),
      rtl: !!term && view.rtl(term),
      onSelect: () => view.onSelect(result),
    };
  };
}

export interface ResultsList<T> {
  /** Draw `items` as rows from the top, a batch at a time as the reader scrolls. */
  render(container: HTMLDivElement, items: readonly T[], toRow: (item: T) => ResultRow): void;
  /** Draw the rows already drawn again with `toRow`, in place and without scrolling. */
  redraw(container: HTMLDivElement, toRow: (item: T) => ResultRow): void;
  /** Stop listening for scrolls, for a container about to be thrown away. */
  detach(container: HTMLDivElement | null): void;
}

export function createResultsList<T>(): ResultsList<T> {
  // How far down the current list we have drawn, so a scroll can carry on where the last batch stopped.
  let shown: readonly T[] = [];
  let toRow: ((item: T) => ResultRow) | null = null;
  let renderedCount = 0;
  let scrollHandler: (() => void) | null = null;

  function appendResultsBatch(container: HTMLDivElement): void {
    if (!toRow || renderedCount >= shown.length) return;

    const end = Math.min(renderedCount + RESULTS_BATCH_SIZE, shown.length);
    for (let i = renderedCount; i < end; i++) {
      container.appendChild(resultRow(toRow(shown[i])));
    }
    renderedCount = end;
  }

  function render(container: HTMLDivElement, items: readonly T[], rowOf: (item: T) => ResultRow) {
    shown = items;
    toRow = rowOf;

    container.querySelectorAll('.search-result').forEach((el) => el.remove());
    renderedCount = 0;
    container.scrollTop = 0;

    detach(container);

    if (items.length === 0) {
      container.classList.remove('visible');
      return;
    }

    appendResultsBatch(container);

    if (renderedCount < items.length) {
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

  function redraw(container: HTMLDivElement, rowOf: (item: T) => ResultRow): void {
    toRow = rowOf;
    container.querySelectorAll('.search-result').forEach((row, i) => {
      row.replaceWith(resultRow(rowOf(shown[i])));
    });
  }

  function detach(container: HTMLDivElement | null): void {
    if (scrollHandler && container) {
      container.removeEventListener('scroll', scrollHandler);
    }
    scrollHandler = null;
  }

  return { render, redraw, detach };
}
