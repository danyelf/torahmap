// Full-text search overlay
import '../styles/overlays/search.css';
import type { Overlay, Color } from './types.ts';
import type { VerseIdentity, VerseLayout } from '../types.ts';
import { getVerseKey } from '../types.ts';
import { search, getMatchingVerseTerms, parseSearchTerms, stripNikkud, isHebrewQuery, findLemmasForWord, getRootForStrongsNumber, type SearchResult } from '../search.ts';
import { SEARCH_COLORS } from '../utils/color.ts';
import { HIGHLIGHT_CONSTANTS } from '../constants.ts';
import { createHebrewKeyboard, closeHebrewKeyboard, isKeyboardOpen } from '../hebrewKeyboard.ts';

function colorToCss(color: Color): string {
  return `rgb(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)})`;
}

// State
let verses: VerseLayout[] = [];
let currentQuery = '';
let currentTerms: string[] = [];
let currentResults: SearchResult[] = [];
let matchingTerms = new Map<string, number[]>();
let wholeWordEnabled = false;
let hebrewSearchMode: 'substring' | 'word' | 'root' = 'substring';
let updateCallback: (() => void) | null = null;
let onVerseClickCallback: ((verse: VerseLayout) => void) | null = null;
// Track which terms have valid lemma data (for root mode visual indicators)
let termLemmaStatus: boolean[] = [];
// Track the lemmas found for each term (for root mode hover info)
let termLemmas: Array<string[] | null> = [];
// Track the Hebrew root text for each term (for legend display)
let termRoots: Array<string | null> = [];

// DOM references (for cleanup)
let searchInput: HTMLInputElement | null = null;
let searchClear: HTMLButtonElement | null = null;
let keyboardToggle: HTMLButtonElement | null = null;
let searchResults: HTMLDivElement | null = null;
let wholeWordCheckbox: HTMLInputElement | null = null;
let hebrewModeContainer: HTMLDivElement | null = null;
let documentClickHandler: ((e: MouseEvent) => void) | null = null;

export function configure(config: { verses: VerseLayout[]; callbacks?: { onVerseClick?: (verse: VerseLayout) => void } }): void {
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
    termLemmaStatus = [];
    termLemmas = [];
    termRoots = [];
  } else {
    const isHebrew = isHebrewQuery(currentTerms[0]);

    // Check which terms have lemma data (only relevant for Hebrew root mode)
    if (isHebrew && hebrewSearchMode === 'root') {
      termLemmaStatus = [];
      termLemmas = [];
      termRoots = [];
      for (const term of currentTerms) {
        const lemmas = findLemmasForWord(term);
        termLemmaStatus.push(lemmas !== null && lemmas.length > 0);
        termLemmas.push(lemmas);

        // Get the Hebrew root text for the first lemma (most relevant)
        if (lemmas && lemmas.length > 0) {
          const rootText = getRootForStrongsNumber(lemmas[0]);
          termRoots.push(rootText);
        } else {
          termRoots.push(null);
        }
      }
    } else {
      termLemmaStatus = [];
      termLemmas = [];
      termRoots = [];
    }

    // Only use wholeWord for English queries
    const useWholeWord = wholeWordEnabled && currentTerms.length > 0 && !isHebrew;
    // Pass hebrewMode for Hebrew searches
    currentResults = search(query, useWholeWord, isHebrew ? hebrewSearchMode : 'substring');
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

// Match interface for search term highlighting
interface Match {
  start: number;
  end: number;
  termIndex: number;
}

/**
 * Check if a character is Hebrew nikkud (diacritical mark)
 */
function isNikkudChar(code: number): boolean {
  return code >= 0x0591 && code <= 0x05C7 &&
         code !== 0x05BE && code !== 0x05C0 && code !== 0x05C3 && code !== 0x05C6;
}

/**
 * Map position in normalized (no nikkud) text back to original text position
 * Accounts for nikkud characters that were stripped during normalization
 */
function mapNormalizedToOriginalPosition(
  text: string,
  normalizedPos: number,
  startFrom: number = 0
): number {
  let nikkudCount = 0;
  let currentNormalizedPos = 0;

  for (let i = startFrom; i < text.length && currentNormalizedPos < normalizedPos; i++) {
    const code = text.charCodeAt(i);
    if (isNikkudChar(code)) {
      nikkudCount++;
    } else {
      currentNormalizedPos++;
    }
  }

  return normalizedPos + nikkudCount;
}

/**
 * Find all matches for all search terms in the given text
 * Handles Hebrew nikkud stripping and position mapping
 * Respects Hebrew search mode (substring/word/root) and English whole-word setting
 */
function findAllTermMatches(text: string, terms: string[], isHebrew: boolean): Match[] {
  const matches: Match[] = [];
  const normalizedText = isHebrew ? stripNikkud(text) : text.toLowerCase();

  for (let termIndex = 0; termIndex < terms.length; termIndex++) {
    const term = terms[termIndex];
    const normalizedTerm = isHebrew ? stripNikkud(term) : term.toLowerCase();

    if (!isHebrew && wholeWordEnabled) {
      // English whole-word matching using regex
      const escapedTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedTerm}\\b`, 'gi');
      let match;
      while ((match = regex.exec(text.toLowerCase())) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          termIndex
        });
      }
    } else if (isHebrew && hebrewSearchMode === 'root') {
      // Hebrew root mode - match words with same lemmas
      const searchLemmas = termLemmas[termIndex];
      if (!searchLemmas || searchLemmas.length === 0) {
        // No lemmas for search term, fall back to word matching
        const words = normalizedText.split(/\s+/);
        let currentPos = 0;

        for (const word of words) {
          while (currentPos < normalizedText.length && /\s/.test(normalizedText[currentPos])) {
            currentPos++;
          }

          if (word === normalizedTerm) {
            const origStart = mapNormalizedToOriginalPosition(text, currentPos);
            const origEnd = mapNormalizedToOriginalPosition(text, currentPos + word.length);
            matches.push({ start: origStart, end: origEnd, termIndex });
          }

          currentPos += word.length;
        }
      } else {
        // Match words that share the same lemmas
        const words = normalizedText.split(/\s+/);
        let currentPos = 0;

        for (const word of words) {
          while (currentPos < normalizedText.length && /\s/.test(normalizedText[currentPos])) {
            currentPos++;
          }

          // Look up this word's lemmas
          const wordLemmas = findLemmasForWord(word);
          if (wordLemmas && wordLemmas.some(lemma => searchLemmas.includes(lemma))) {
            // This word shares a lemma with the search term
            const origStart = mapNormalizedToOriginalPosition(text, currentPos);
            const origEnd = mapNormalizedToOriginalPosition(text, currentPos + word.length);
            matches.push({ start: origStart, end: origEnd, termIndex });
          }

          currentPos += word.length;
        }
      }
    } else if (isHebrew && hebrewSearchMode === 'word') {
      // Hebrew whole-word matching
      const words = normalizedText.split(/\s+/);
      let currentPos = 0;

      for (const word of words) {
        // Skip whitespace to find word start in original text
        while (currentPos < normalizedText.length && /\s/.test(normalizedText[currentPos])) {
          currentPos++;
        }

        if (word === normalizedTerm) {
          // Found a match - map to original text position
          const origStart = mapNormalizedToOriginalPosition(text, currentPos);
          const origEnd = mapNormalizedToOriginalPosition(text, currentPos + word.length);

          matches.push({ start: origStart, end: origEnd, termIndex });
        }

        currentPos += word.length;
      }
    } else {
      // Substring search (for Hebrew substring mode and English non-whole-word)
      let searchStart = 0;
      while (true) {
        const idx = normalizedText.indexOf(normalizedTerm, searchStart);
        if (idx === -1) break;

        // Map normalized positions back to original text
        let origStart = idx;
        let origEnd = idx + normalizedTerm.length;

        if (isHebrew) {
          origStart = mapNormalizedToOriginalPosition(text, idx);
          origEnd = mapNormalizedToOriginalPosition(text, idx + normalizedTerm.length);
        }

        matches.push({ start: origStart, end: origEnd, termIndex });
        searchStart = idx + 1;
      }
    }
  }

  return matches;
}

/**
 * Remove overlapping matches, keeping the first/longest match
 * Assumes matches are already sorted by position
 */
function removeOverlappingMatches(matches: Match[]): Match[] {
  const filtered: Match[] = [];
  for (const m of matches) {
    if (filtered.length === 0 || m.start >= filtered[filtered.length - 1].end) {
      filtered.push(m);
    }
  }
  return filtered;
}

/**
 * Build DOM fragment with highlighted matches
 */
function buildHighlightedDomFragment(text: string, matches: Match[]): DocumentFragment {
  const fragment = document.createDocumentFragment();

  let pos = 0;
  for (const m of matches) {
    // Add text before this match
    if (m.start > pos) {
      fragment.appendChild(document.createTextNode(text.slice(pos, m.start)));
    }

    // Add highlighted match
    const mark = document.createElement('mark');
    mark.className = `term-${m.termIndex % 5}`;
    mark.textContent = text.slice(m.start, m.end);
    fragment.appendChild(mark);

    pos = m.end;
  }

  // Add remaining text after last match
  if (pos < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(pos)));
  }

  return fragment;
}

/**
 * Highlight all search terms in text with per-term colors
 * Returns DocumentFragment with <mark class="term-N"> elements
 * Safer than innerHTML - builds DOM programmatically
 */
export function highlightSearchTerms(text: string, language: 'he' | 'en'): DocumentFragment {
  const fragment = document.createDocumentFragment();

  if (currentTerms.length === 0) {
    fragment.appendChild(document.createTextNode(text));
    return fragment;
  }

  const isHebrew = language === 'he';

  // Find all matches
  const matches = findAllTermMatches(text, currentTerms, isHebrew);

  if (matches.length === 0) {
    fragment.appendChild(document.createTextNode(text));
    return fragment;
  }

  // Sort by position, longest match first for overlaps
  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  // Remove overlapping matches (keep first/longest)
  const filtered = removeOverlappingMatches(matches);

  // Build result with highlights
  return buildHighlightedDomFragment(text, filtered);
}

export const searchOverlay: Overlay = {
  id: 'search',
  name: 'Text Search',

  getVerseColor(verse: VerseIdentity): Color | Color[] | null {
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
        <input type="text" id="search-input" class="keyboardInput" placeholder="Search Hebrew or English...">
        <button id="keyboard-toggle" title="Toggle Hebrew keyboard">א</button>
        <button id="search-clear">&times;</button>
      </div>
      <div id="search-options">
        <label>
          <input type="checkbox" id="whole-word-checkbox">
          Match whole words only
        </label>
      </div>
      <div id="hebrew-mode-container" style="display: none;">
        <div class="hebrew-mode-label">Hebrew search mode:</div>
        <label class="hebrew-mode-option">
          <input type="radio" name="hebrew-mode" value="substring" checked>
          Substring
        </label>
        <label class="hebrew-mode-option">
          <input type="radio" name="hebrew-mode" value="word">
          Whole word
        </label>
        <label class="hebrew-mode-option">
          <input type="radio" name="hebrew-mode" value="root">
          Root (שרש)
        </label>
      </div>
      <div id="search-results">
        <div id="search-count"></div>
      </div>
    `;

    searchInput = container.querySelector('#search-input');
    searchClear = container.querySelector('#search-clear');
    keyboardToggle = container.querySelector('#keyboard-toggle');
    searchResults = container.querySelector('#search-results');
    wholeWordCheckbox = container.querySelector('#whole-word-checkbox');
    hebrewModeContainer = container.querySelector('#hebrew-mode-container');

    // Restore current query if any
    if (searchInput && currentQuery) {
      searchInput.value = currentQuery;
      const isHebrew = isHebrewQuery(currentQuery);

      // Set RTL if Hebrew
      if (isHebrew) {
        searchInput.dir = 'rtl';
      }

      // Hide checkbox for Hebrew
      if (wholeWordCheckbox) {
        const optionsContainer = wholeWordCheckbox.closest('#search-options') as HTMLElement;
        if (optionsContainer) {
          optionsContainer.style.display = isHebrew ? 'none' : 'block';
        }
      }

      // Show Hebrew mode selector for Hebrew
      if (hebrewModeContainer) {
        hebrewModeContainer.style.display = isHebrew ? 'block' : 'none';
      }

      if (searchClear) {
        searchClear.style.display = currentQuery ? 'block' : 'none';
      }
      if (currentResults.length > 0) {
        renderResults();
      }
    }

    // Restore whole-word checkbox state
    if (wholeWordCheckbox) {
      wholeWordCheckbox.checked = wholeWordEnabled;
    }

    // Restore Hebrew mode radio state
    if (hebrewModeContainer) {
      const radioButtons = hebrewModeContainer.querySelectorAll<HTMLInputElement>('input[name="hebrew-mode"]');
      radioButtons.forEach(radio => {
        if (radio.value === hebrewSearchMode) {
          radio.checked = true;
        }
      });
    }

    // Update text direction and checkbox/mode visibility based on input content
    const updateInputMode = () => {
      if (!searchInput) return;
      const query = searchInput.value;
      const queryIsHebrew = query.length > 0 && isHebrewQuery(query);
      // Consider it Hebrew mode if the query is Hebrew OR the keyboard is open
      const isHebrew = queryIsHebrew || isKeyboardOpen();

      // Set text direction
      if (query.length === 0) {
        searchInput.dir = isKeyboardOpen() ? 'rtl' : 'ltr';
      } else if (queryIsHebrew) {
        searchInput.dir = 'rtl';
      } else {
        searchInput.dir = 'ltr';
      }

      // Hide checkbox for Hebrew (whole-word doesn't apply)
      if (wholeWordCheckbox) {
        const optionsContainer = wholeWordCheckbox.closest('#search-options') as HTMLElement;
        if (optionsContainer) {
          optionsContainer.style.display = isHebrew ? 'none' : 'block';
        }
      }

      // Show Hebrew mode selector for Hebrew queries or when keyboard is open
      if (hebrewModeContainer) {
        hebrewModeContainer.style.display = isHebrew ? 'block' : 'none';
      }
    };

    // Strip nikkud from pasted Hebrew text
    searchInput?.addEventListener('paste', (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain');
      if (text && isHebrewQuery(text)) {
        // Prevent default paste
        e.preventDefault();

        // Strip nikkud and insert
        const stripped = stripNikkud(text);

        // Insert at cursor position
        const input = searchInput!;
        const start = input.selectionStart ?? 0;
        const end = input.selectionEnd ?? 0;
        const currentValue = input.value;

        // Build new value
        input.value = currentValue.slice(0, start) + stripped + currentValue.slice(end);

        // Set cursor position after inserted text
        const newCursorPos = start + stripped.length;
        input.setSelectionRange(newCursorPos, newCursorPos);

        // Trigger input event to update search
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    searchInput?.addEventListener('input', () => {
      // Strip nikkud from typed Hebrew text
      const input = searchInput!;
      const currentValue = input.value;

      // Check if there's Hebrew text with nikkud
      if (currentValue && isHebrewQuery(currentValue)) {
        const stripped = stripNikkud(currentValue);

        // Only update if nikkud was actually stripped
        if (stripped !== currentValue) {
          const cursorPos = input.selectionStart ?? currentValue.length;

          // Calculate new cursor position accounting for removed nikkud
          let nikkudBeforeCursor = 0;
          for (let i = 0; i < Math.min(cursorPos, currentValue.length); i++) {
            const code = currentValue.charCodeAt(i);
            if (isNikkudChar(code)) {
              nikkudBeforeCursor++;
            }
          }

          // Set stripped value
          input.value = stripped;

          // Restore cursor position
          const newCursorPos = cursorPos - nikkudBeforeCursor;
          input.setSelectionRange(newCursorPos, newCursorPos);
        }
      }

      const query = input.value.trim();
      updateInputMode();
      if (searchClear) {
        searchClear.style.display = query ? 'block' : 'none';
      }
      doSearch(query);
    });

    searchClear?.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.dir = 'ltr';
        searchClear!.style.display = 'none';
      }
      // Show checkbox again when clearing (back to English mode)
      if (wholeWordCheckbox) {
        const optionsContainer = wholeWordCheckbox.closest('#search-options') as HTMLElement;
        if (optionsContainer) {
          optionsContainer.style.display = 'block';
        }
      }
      // Hide Hebrew mode selector when clearing
      if (hebrewModeContainer) {
        hebrewModeContainer.style.display = 'none';
      }
      doSearch('');
    });

    wholeWordCheckbox?.addEventListener('change', () => {
      wholeWordEnabled = wholeWordCheckbox!.checked;
      // Re-run search with new setting
      if (currentQuery) {
        doSearch(currentQuery);
      }
      // Trigger URL update
      updateCallback?.();
    });

    // Add event listeners for Hebrew mode radio buttons
    if (hebrewModeContainer) {
      const radioButtons = hebrewModeContainer.querySelectorAll<HTMLInputElement>('input[name="hebrew-mode"]');
      radioButtons.forEach(radio => {
        radio.addEventListener('change', () => {
          if (radio.checked) {
            hebrewSearchMode = radio.value as 'substring' | 'word' | 'root';
            // Re-run search with new mode
            if (currentQuery) {
              doSearch(currentQuery);
            }
            // Trigger URL update (doSearch calls updateCallback, but we call it here too
            // to ensure URL is updated even if doSearch behavior changes)
            updateCallback?.();
          }
        });
      });
    }

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

    // Toggle Hebrew keyboard on button click
    keyboardToggle?.addEventListener('click', () => {
      if (searchInput) {
        if (isKeyboardOpen()) {
          closeHebrewKeyboard();
          keyboardToggle!.classList.remove('active');
        } else {
          createHebrewKeyboard(searchInput);
          keyboardToggle!.classList.add('active');
        }
        // Update mode selector visibility after keyboard state changes
        updateInputMode();
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

        // For root mode, show the actual root that was found
        if (hebrewSearchMode === 'root' && termLemmaStatus.length > 0) {
          if (termLemmaStatus[i] && termRoots[i]) {
            // Show root (from search_term) format
            termSpan.appendChild(document.createTextNode(`"${termRoots[i]}" (from "${term}")`));
          } else {
            // No root found, show term with fallback indicator
            termSpan.appendChild(document.createTextNode(`"${term}"`));
            const indicator = document.createElement('span');
            indicator.className = 'lemma-indicator';
            indicator.textContent = ' \u21AA'; // hook arrow
            indicator.title = 'No root data, using whole-word search';
            indicator.style.color = '#FF9800'; // orange
            termSpan.appendChild(indicator);
          }
        } else {
          // For non-root modes, just show the term
          termSpan.appendChild(document.createTextNode(`"${term}"`));
        }

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

  getHoverInfo(verse: VerseIdentity): string | null {
    if (currentTerms.length === 0) return null;

    const key = getVerseKey(verse.book, verse.chapter, verse.verse);
    const termIndices = matchingTerms.get(key);
    if (!termIndices) return null;

    // Show which terms matched, with mode-specific formatting
    const isHebrew = isHebrewQuery(currentTerms[0]);

    if (isHebrew && hebrewSearchMode === 'root') {
      // For root mode, show which roots were matched
      const matchedTerms = termIndices.map(i => {
        const lemmas = termLemmas[i];
        const root = termRoots[i];
        if (lemmas && lemmas.length > 0 && root) {
          // Found a root - show the actual root from Strong's
          return `"${root}"`;
        } else {
          // No root found, fell back to word search
          return `"${currentTerms[i]}"`;
        }
      }).join(', ');
      return `Matches root: ${matchedTerms}`;
    } else if (isHebrew && hebrewSearchMode === 'word') {
      const matchedTerms = termIndices.map(i => `"${currentTerms[i]}"`).join(', ');
      return `Matches word: ${matchedTerms}`;
    } else {
      const matchedTerms = termIndices.map(i => `"${currentTerms[i]}"`).join(', ');
      return `Matches: ${matchedTerms}`;
    }
  },

  onUpdate(callback: () => void): void {
    updateCallback = callback;
  },

  destroy(): void {
    // Close Hebrew keyboard
    closeHebrewKeyboard();
    // Clean up event listener
    if (documentClickHandler) {
      document.removeEventListener('click', documentClickHandler);
      documentClickHandler = null;
    }
    // Clear DOM references (for memory cleanup)
    searchInput = null;
    searchClear = null;
    keyboardToggle = null;
    searchResults = null;
    wholeWordCheckbox = null;
    hebrewModeContainer = null;
    // Clear callbacks
    updateCallback = null;
    onVerseClickCallback = null;
    // NOTE: We intentionally DO NOT reset currentQuery, currentTerms, currentResults,
    // matchingTerms, wholeWordEnabled, hebrewSearchMode, or related state here.
    // These should persist across overlay switches so the user can return to their search.
  },

  getUrlParams(): Record<string, string> {
    const params: Record<string, string> = {};
    if (currentQuery) {
      params.q = currentQuery;
    }
    if (wholeWordEnabled) {
      params.ww = '1';
    }
    // Only include hebrewMode if it's not the default (substring)
    if (currentQuery && isHebrewQuery(currentQuery) && hebrewSearchMode !== 'substring') {
      params.hm = hebrewSearchMode;
    }
    return params;
  },

  applyUrlParams(params: URLSearchParams): void {
    const query = params.get('q');
    const wholeWord = params.get('ww');
    const hebrewMode = params.get('hm');

    // Restore whole-word setting
    if (wholeWord === '1') {
      wholeWordEnabled = true;
      if (wholeWordCheckbox) {
        wholeWordCheckbox.checked = true;
      }
    }

    // Restore Hebrew mode setting
    if (hebrewMode === 'word' || hebrewMode === 'root') {
      hebrewSearchMode = hebrewMode;
      if (hebrewModeContainer) {
        const radioButtons = hebrewModeContainer.querySelectorAll<HTMLInputElement>('input[name="hebrew-mode"]');
        radioButtons.forEach(radio => {
          if (radio.value === hebrewMode) {
            radio.checked = true;
          }
        });
      }
    }

    if (query) {
      doSearch(query);
      // Update input if it exists
      if (searchInput) {
        searchInput.value = query;
        const isHebrew = isHebrewQuery(query);

        // Set RTL if Hebrew
        if (isHebrew) {
          searchInput.dir = 'rtl';
        }

        // Hide checkbox for Hebrew
        if (wholeWordCheckbox) {
          const optionsContainer = wholeWordCheckbox.closest('#search-options') as HTMLElement;
          if (optionsContainer) {
            optionsContainer.style.display = isHebrew ? 'none' : 'block';
          }
        }

        // Show Hebrew mode selector for Hebrew
        if (hebrewModeContainer) {
          hebrewModeContainer.style.display = isHebrew ? 'block' : 'none';
        }

        if (searchClear) {
          searchClear.style.display = 'block';
        }
      }
    }
  },

  highlightVerseText(text: string, language: 'he' | 'en'): DocumentFragment | string {
    return highlightSearchTerms(text, language);
  },
};
