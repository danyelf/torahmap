// Full-text search overlay
import type { Overlay, Color } from './types.ts';
import type { Verse } from '../types.ts';
import { getVerseKey } from '../types.ts';
import { search, getMatchingVerseTerms, parseSearchTerms, stripNikkud, type SearchResult } from '../search.ts';
import { SEARCH_COLORS } from '../utils/color.ts';
import { HIGHLIGHT_CONSTANTS } from '../constants.ts';

function colorToCss(color: Color): string {
  return `rgb(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)})`;
}

export function createSearchOverlay(): Overlay {
  // State - encapsulated in closure
  let verses: Verse[] = [];
  let currentQuery = '';
  let currentTerms: string[] = [];
  let currentResults: SearchResult[] = [];
  let matchingTerms = new Map<string, number[]>();
  let updateCallback: (() => void) | null = null;
  let onVerseClickCallback: ((verse: Verse) => void) | null = null;

  // DOM references (for cleanup)
  let searchInput: HTMLInputElement | null = null;
  let searchClear: HTMLButtonElement | null = null;
  let searchResults: HTMLDivElement | null = null;
  let documentClickHandler: ((e: MouseEvent) => void) | null = null;

  function configure(config: { verses: Verse[]; callbacks?: { onVerseClick?: (verse: Verse) => void } }): void {
    verses = config.verses;
    if (config.callbacks?.onVerseClick) {
      onVerseClickCallback = config.callbacks.onVerseClick;
    }
  }

  function doSearch(query: string): void {
    currentQuery = query;
    currentTerms = parseSearchTerms(query);

    if (currentTerms.length === 0) {
      currentResults = [];
      matchingTerms = new Map();
    } else {
      currentResults = search(query);
      matchingTerms = getMatchingVerseTerms(currentResults);
    }

    renderResults();
    updateCallback?.();
  }

  function renderResults(): void {
    if (!searchResults) return;

    // Clear previous results (keep count div)
    const existingResults = searchResults.querySelectorAll('.search-result');
    existingResults.forEach(el => el.remove());

    const searchCount = searchResults.querySelector('#search-count') as HTMLDivElement;

    if (currentResults.length === 0) {
      searchResults.classList.remove('visible');
      if (searchCount) searchCount.textContent = '';
      return;
    }

    // Update count with term info
    if (searchCount) {
      const termInfo = currentTerms.length > 1 ? ` (${currentTerms.length} terms)` : '';
      searchCount.textContent = `${currentResults.length}${currentResults.length >= 100 ? '+' : ''} results${termInfo}`;
    }

    // Show up to 10 results
    const displayResults = currentResults.slice(0, 10);
    for (const result of displayResults) {
      const div = document.createElement('div');
      div.className = 'search-result';

      // Create ref div with term indicators
      const refDiv = document.createElement('div');
      refDiv.className = 'ref';

      // Create term indicator dots programmatically
      const termIndicators = document.createElement('span');
      termIndicators.className = 'term-indicators';
      for (const m of result.matchingTerms) {
        const dot = document.createElement('span');
        dot.className = 'term-dot';
        const color = SEARCH_COLORS[m.termIndex % SEARCH_COLORS.length];
        dot.style.background = colorToCss(color);
        termIndicators.appendChild(dot);
      }
      refDiv.appendChild(termIndicators);
      refDiv.appendChild(document.createTextNode(`${result.book} ${result.chapter}:${result.verse}`));

      // Create snippet div with highlighting
      const snippetDiv = document.createElement('div');
      snippetDiv.className = `snippet ${result.language === 'he' ? 'rtl' : ''}`;

      // Use first match's snippet for display
      const firstMatch = result.matchingTerms[0];
      const snippetContent = createHighlightedText(
        firstMatch.snippet,
        firstMatch.matchStart,
        firstMatch.matchEnd,
        firstMatch.termIndex
      );
      snippetDiv.appendChild(snippetContent);

      div.appendChild(refDiv);
      div.appendChild(snippetDiv);

      div.addEventListener('click', () => {
        const verse = verses.find(v =>
          v.book === result.book &&
          v.chapter === result.chapter &&
          v.verse === result.verse
        );
        if (verse && onVerseClickCallback) {
          onVerseClickCallback(verse);
        }
      });
      searchResults.appendChild(div);
    }

    searchResults.classList.add('visible');
  }

  /**
   * Create a DocumentFragment with highlighted text
   * Safer than innerHTML - builds DOM programmatically
   */
  function createHighlightedText(text: string, start: number, end: number, termIndex: number): DocumentFragment {
    const fragment = document.createDocumentFragment();

    if (start > 0) {
      fragment.appendChild(document.createTextNode(text.slice(0, start)));
    }

    const mark = document.createElement('mark');
    mark.className = `term-${termIndex % 5}`;
    mark.textContent = text.slice(start, end);
    fragment.appendChild(mark);

    if (end < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(end)));
    }

    return fragment;
  }

  /**
   * Highlight all search terms in text with per-term colors
   * Returns DocumentFragment with <mark class="term-N"> elements
   * Safer than innerHTML - builds DOM programmatically
   */
  function highlightSearchTerms(text: string, language: 'he' | 'en'): DocumentFragment {
    const fragment = document.createDocumentFragment();

    if (currentTerms.length === 0) {
      fragment.appendChild(document.createTextNode(text));
      return fragment;
    }

    const isHebrew = language === 'he';

    // Build list of all matches with their positions
    interface Match {
      start: number;
      end: number;
      termIndex: number;
    }
    const matches: Match[] = [];

    // Prepare normalized text for searching
    const normalizedText = isHebrew ? stripNikkud(text) : text.toLowerCase();

    for (let termIndex = 0; termIndex < currentTerms.length; termIndex++) {
      const term = currentTerms[termIndex];
      const normalizedTerm = isHebrew ? stripNikkud(term) : term.toLowerCase();

      // Find all occurrences
      let searchStart = 0;
      while (true) {
        const idx = normalizedText.indexOf(normalizedTerm, searchStart);
        if (idx === -1) break;

        // Map back to original text position for Hebrew (nikkud may shift positions)
        let origStart = idx;
        let origEnd = idx + normalizedTerm.length;

        if (isHebrew) {
          // Count how many nikkud chars before this position
          let nikkudBefore = 0;
          let normalizedPos = 0;
          for (let i = 0; i < text.length && normalizedPos < idx; i++) {
            const code = text.charCodeAt(i);
            const isNikkud = code >= 0x0591 && code <= 0x05C7 &&
                             code !== 0x05BE && code !== 0x05C0 && code !== 0x05C3 && code !== 0x05C6;
            if (isNikkud) {
              nikkudBefore++;
            } else {
              normalizedPos++;
            }
          }
          origStart = idx + nikkudBefore;

          // Find end position accounting for nikkud within the match
          let nikkudInMatch = 0;
          normalizedPos = 0;
          for (let i = origStart; i < text.length && normalizedPos < normalizedTerm.length; i++) {
            const code = text.charCodeAt(i);
            const isNikkud = code >= 0x0591 && code <= 0x05C7 &&
                             code !== 0x05BE && code !== 0x05C0 && code !== 0x05C3 && code !== 0x05C6;
            if (isNikkud) {
              nikkudInMatch++;
            } else {
              normalizedPos++;
            }
          }
          origEnd = origStart + normalizedTerm.length + nikkudInMatch;
        }

        matches.push({ start: origStart, end: origEnd, termIndex });
        searchStart = idx + 1;
      }
    }

    if (matches.length === 0) {
      fragment.appendChild(document.createTextNode(text));
      return fragment;
    }

    // Sort by position, longest match first for overlaps
    matches.sort((a, b) => a.start - b.start || b.end - a.end);

    // Remove overlapping matches (keep first/longest)
    const filtered: Match[] = [];
    for (const m of matches) {
      if (filtered.length === 0 || m.start >= filtered[filtered.length - 1].end) {
        filtered.push(m);
      }
    }

    // Build result with highlights using DOM
    let pos = 0;
    for (const m of filtered) {
      if (m.start > pos) {
        fragment.appendChild(document.createTextNode(text.slice(pos, m.start)));
      }
      const mark = document.createElement('mark');
      mark.className = `term-${m.termIndex % 5}`;
      mark.textContent = text.slice(m.start, m.end);
      fragment.appendChild(mark);
      pos = m.end;
    }
    if (pos < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(pos)));
    }

    return fragment;
  }

  const overlay: Overlay & {
    configure: typeof configure;
    highlightSearchTerms: typeof highlightSearchTerms;
  } = {
  id: 'search',
  name: 'Text Search',

  getVerseColor(verse: Verse): Color | Color[] | null {
    // No active search - use default colors
    if (currentTerms.length === 0) {
      return null;
    }

    const key = getVerseKey(verse.book, verse.chapter, verse.verse);
    const termIndices = matchingTerms.get(key);

    if (termIndices && termIndices.length > 0) {
      // Get colors for all matching terms
      const colors = termIndices.map(i => SEARCH_COLORS[i % SEARCH_COLORS.length]);
      // Return array for stipple effect if multiple, otherwise single color
      if (colors.length === 1) {
        return colors[0];
      }
      // Return multiple colors for stipple effect (capped at 4)
      return colors.slice(0, 4) as Color[];
    }

    // Dim non-matching verses
    const brightness = (0.4 + 0.2) * HIGHLIGHT_CONSTANTS.DIM_FACTOR;
    return [brightness, brightness, brightness];
  },

  renderControls(container: HTMLElement): void {
    container.innerHTML = `
      <div id="search-container">
        <input type="text" id="search-input" placeholder="Search Hebrew or English...">
        <button id="search-clear">&times;</button>
        <div id="search-results">
          <div id="search-count"></div>
        </div>
      </div>
    `;

    searchInput = container.querySelector('#search-input');
    searchClear = container.querySelector('#search-clear');
    searchResults = container.querySelector('#search-results');

    // Restore current query if any
    if (searchInput && currentQuery) {
      searchInput.value = currentQuery;
      if (searchClear) {
        searchClear.style.display = currentQuery ? 'block' : 'none';
      }
      if (currentResults.length > 0) {
        renderResults();
      }
    }

    searchInput?.addEventListener('input', () => {
      const query = searchInput!.value.trim();
      if (searchClear) {
        searchClear.style.display = query ? 'block' : 'none';
      }
      doSearch(query);
    });

    searchClear?.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchClear!.style.display = 'none';
      }
      doSearch('');
    });

    // Close results when clicking outside
    // Remove any existing handler first to prevent memory leak
    if (documentClickHandler) {
      document.removeEventListener('click', documentClickHandler);
    }
    documentClickHandler = (e: MouseEvent) => {
      if (searchResults && !searchResults.contains(e.target as Node) &&
          e.target !== searchInput && e.target !== searchClear) {
        searchResults.classList.remove('visible');
      }
    };
    document.addEventListener('click', documentClickHandler);

    // Re-show results when focusing input
    searchInput?.addEventListener('focus', () => {
      if (currentResults.length > 0) {
        searchResults?.classList.add('visible');
      }
    });
  },

  renderLegend(container: HTMLElement): void {
    // Clear container
    container.textContent = '';

    if (currentTerms.length > 0 && currentResults.length > 0) {
      const legendDiv = document.createElement('div');
      legendDiv.className = 'search-legend';

      for (let i = 0; i < currentTerms.length; i++) {
        const term = currentTerms[i];
        const color = SEARCH_COLORS[i % SEARCH_COLORS.length];

        const termSpan = document.createElement('span');
        termSpan.className = 'legend-term';

        const swatch = document.createElement('span');
        swatch.className = 'color-swatch';
        swatch.style.background = colorToCss(color);
        termSpan.appendChild(swatch);

        termSpan.appendChild(document.createTextNode(`"${term}"`));
        legendDiv.appendChild(termSpan);

        if (i < currentTerms.length - 1) {
          legendDiv.appendChild(document.createTextNode(' '));
        }
      }

      const countDiv = document.createElement('div');
      countDiv.style.color = '#888';
      countDiv.style.fontSize = '11px';
      countDiv.style.marginTop = '4px';
      countDiv.textContent = `${currentResults.length} matching verses`;

      container.appendChild(legendDiv);
      container.appendChild(countDiv);
    } else if (currentQuery.length > 0 && currentTerms.length === 0) {
      const hintDiv = document.createElement('div');
      hintDiv.style.color = '#888';
      hintDiv.style.fontSize = '11px';
      hintDiv.textContent = 'Type at least 2 characters per term';
      container.appendChild(hintDiv);
    } else {
      const hintDiv = document.createElement('div');
      hintDiv.style.color = '#888';
      hintDiv.style.fontSize = '11px';
      hintDiv.textContent = 'Type to search (comma-separate multiple terms)';
      container.appendChild(hintDiv);
    }
  },

  getHoverInfo(verse: Verse): string | null {
    if (currentTerms.length === 0) return null;

    const key = getVerseKey(verse.book, verse.chapter, verse.verse);
    const termIndices = matchingTerms.get(key);
    if (!termIndices) return null;

    // Show which terms matched
    const matchedTerms = termIndices.map(i => `"${currentTerms[i]}"`).join(', ');
    return `Matches: ${matchedTerms}`;
  },

  onUpdate(callback: () => void): void {
    updateCallback = callback;
  },

  destroy(): void {
    // Clean up event listener
    if (documentClickHandler) {
      document.removeEventListener('click', documentClickHandler);
      documentClickHandler = null;
    }
    // Clear DOM references
    searchInput = null;
    searchClear = null;
    searchResults = null;
    // Reset state
    currentQuery = '';
    currentTerms = [];
    currentResults = [];
    matchingTerms.clear();
    updateCallback = null;
    onVerseClickCallback = null;
  },

  getUrlParams(): Record<string, string> {
    if (!currentQuery) return {};
    return { q: currentQuery };
  },

  applyUrlParams(params: URLSearchParams): void {
    const query = params.get('q');
    if (query) {
      doSearch(query);
      // Update input if it exists
      if (searchInput) {
        searchInput.value = query;
        if (searchClear) {
          searchClear.style.display = 'block';
        }
      }
    }
  },

  // Expose configuration methods on overlay instance
  configure,
  highlightSearchTerms,
  };

  return overlay;
}

// Create singleton instance
export const searchOverlay = createSearchOverlay();

// Export helper methods for external use (backward compatibility with tests)
export const configure = searchOverlay.configure;
export const highlightSearchTerms = searchOverlay.highlightSearchTerms;
