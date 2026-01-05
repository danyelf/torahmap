// Full-text search overlay
import type { Overlay, Color } from './types.ts';
import type { Verse } from '../types.ts';
import { getVerseKey } from '../types.ts';
import { search, getMatchingVerseTerms, parseSearchTerms, type SearchResult } from '../search.ts';
import { SEARCH_COLORS, DIM_FACTOR, blendColorsHSL } from '../utils/color.ts';

function colorToCss(color: Color): string {
  return `rgb(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)})`;
}

// State
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

export function configure(config: { verses: Verse[]; callbacks?: { onVerseClick?: (verse: Verse) => void } }): void {
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

    // Build term indicator dots
    const dots = result.matchingTerms
      .map(m => {
        const color = SEARCH_COLORS[m.termIndex % SEARCH_COLORS.length];
        return `<span class="term-dot" style="background: ${colorToCss(color)}"></span>`;
      })
      .join('');

    // Use first match's snippet for display
    const firstMatch = result.matchingTerms[0];
    const snippetHtml = escapeAndHighlight(
      firstMatch.snippet,
      firstMatch.matchStart,
      firstMatch.matchEnd,
      firstMatch.termIndex
    );

    div.innerHTML = `
      <div class="ref">
        <span class="term-indicators">${dots}</span>
        ${result.book} ${result.chapter}:${result.verse}
      </div>
      <div class="snippet ${result.language === 'he' ? 'rtl' : ''}">${snippetHtml}</div>
    `;
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

function escapeAndHighlight(text: string, start: number, end: number, termIndex: number): string {
  const before = escapeHtml(text.slice(0, start));
  const match = escapeHtml(text.slice(start, end));
  const after = escapeHtml(text.slice(end));
  return `${before}<mark class="term-${termIndex % 5}">${match}</mark>${after}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const searchOverlay: Overlay = {
  id: 'search',
  name: 'Text Search',

  getVerseColor(verse: Verse): Color | null {
    // No active search - use default colors
    if (currentTerms.length === 0) {
      return null;
    }

    const key = getVerseKey(verse.book, verse.chapter, verse.verse);
    const termIndices = matchingTerms.get(key);

    if (termIndices && termIndices.length > 0) {
      // Get colors for all matching terms
      const colors = termIndices.map(i => SEARCH_COLORS[i % SEARCH_COLORS.length]);
      // Blend if multiple, otherwise use single color
      return colors.length === 1 ? colors[0] : blendColorsHSL(colors);
    }

    // Dim non-matching verses
    const brightness = (0.4 + 0.2) * DIM_FACTOR;
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
    if (currentResults.length > 0) {
      container.innerHTML = `<div style="color: #888; font-size: 11px;">${currentResults.length} matching verses highlighted</div>`;
    } else if (currentQuery.length > 0 && currentTerms.length === 0) {
      container.innerHTML = `<div style="color: #888; font-size: 11px;">Type at least 2 characters per term</div>`;
    } else {
      container.innerHTML = `<div style="color: #888; font-size: 11px;">Type to search Hebrew or English text</div>`;
    }
  },

  getHoverInfo(verse: Verse): string | null {
    if (currentTerms.length === 0) return null;

    const key = getVerseKey(verse.book, verse.chapter, verse.verse);
    if (!matchingTerms.has(key)) return null;

    // Find the result for this verse
    const result = currentResults.find(r =>
      r.book === verse.book &&
      r.chapter === verse.chapter &&
      r.verse === verse.verse
    );

    if (result && result.matchingTerms.length > 0) {
      const firstMatch = result.matchingTerms[0];
      return `Match: "${firstMatch.snippet.replace(/\.\.\./g, '').trim()}"`;
    }
    return 'Match';
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
  },
};
