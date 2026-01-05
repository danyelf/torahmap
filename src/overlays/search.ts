// Full-text search overlay
import type { Overlay, Color } from './types.ts';
import type { Verse } from '../types.ts';
import { getVerseKey } from '../types.ts';
import { search, getMatchingVerseKeys, type SearchResult } from '../search.ts';
import { HIGHLIGHT_COLOR, DIM_FACTOR } from '../utils/color.ts';

// State
let verses: Verse[] = [];
let currentQuery = '';
let currentResults: SearchResult[] = [];
let matchingKeys = new Set<string>();
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

  if (query.length < 2) {
    currentResults = [];
    matchingKeys = new Set();
  } else {
    currentResults = search(query);
    matchingKeys = getMatchingVerseKeys(currentResults);
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

  // Update count
  if (searchCount) {
    searchCount.textContent = `${currentResults.length}${currentResults.length >= 100 ? '+' : ''} results`;
  }

  // Show up to 10 results
  const displayResults = currentResults.slice(0, 10);
  for (const result of displayResults) {
    const div = document.createElement('div');
    div.className = 'search-result';
    div.innerHTML = `
      <div class="ref">${result.book} ${result.chapter}:${result.verse}</div>
      <div class="snippet ${result.language === 'he' ? 'rtl' : ''}">${escapeAndHighlight(result.snippet, result.matchStart, result.matchEnd)}</div>
    `;
    div.addEventListener('click', () => {
      // Find the verse and trigger callback
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

function escapeAndHighlight(text: string, start: number, end: number): string {
  const before = escapeHtml(text.slice(0, start));
  const match = escapeHtml(text.slice(start, end));
  const after = escapeHtml(text.slice(end));
  return `${before}<mark>${match}</mark>${after}`;
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
    if (currentQuery.length < 2) {
      return null;
    }

    const key = getVerseKey(verse.book, verse.chapter, verse.verse);
    if (matchingKeys.has(key)) {
      return HIGHLIGHT_COLOR;
    }

    // Dim non-matching verses
    const brightness = (0.4 + 0.2) * DIM_FACTOR; // Approximate middle gray dimmed
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
    } else if (currentQuery.length > 0 && currentQuery.length < 2) {
      container.innerHTML = `<div style="color: #888; font-size: 11px;">Type at least 2 characters</div>`;
    } else {
      container.innerHTML = `<div style="color: #888; font-size: 11px;">Type to search Hebrew or English text</div>`;
    }
  },

  getHoverInfo(verse: Verse): string | null {
    if (currentQuery.length < 2) return null;

    const key = getVerseKey(verse.book, verse.chapter, verse.verse);
    if (!matchingKeys.has(key)) return null;

    // Find the result for this verse
    const result = currentResults.find(r =>
      r.book === verse.book &&
      r.chapter === verse.chapter &&
      r.verse === verse.verse
    );

    if (result) {
      return `Match: "${result.snippet.replace(/\.\.\./g, '').trim()}"`;
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
