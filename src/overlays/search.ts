// Full-text search overlay
import '../styles/overlays/search.css';
import type { Overlay, Color } from './types.ts';
import type { TanakhIdentity, TanakhLayout } from '../types.ts';
import { tanakhKey } from '../types.ts';
import { search, getMatchingVerseTerms, parseSearchTerms, stripNikkud, isHebrewQuery, findLemmasForWord, getRelatedRoots, getRootForStrongsNumber, computeSnippetForMatch, type SearchResult, type RelatedRoot } from '../search.ts';
import { SEARCH_COLORS } from '../utils/color.ts';
import { HIGHLIGHT_CONSTANTS } from '../constants.ts';
import { currentTheme } from '../themes.ts';
import { createHebrewKeyboard, closeHebrewKeyboard, isKeyboardOpen } from '../hebrewKeyboard.ts';
import { trackSearchExecute, trackKeyboardToggle } from '../analytics.ts';

function colorToCss(color: Color): string {
  return `rgb(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)})`;
}

// State
let verses: TanakhLayout[] = [];
let currentQuery = '';
let currentTerms: string[] = [];
let currentResults: SearchResult[] = [];
let matchingTerms = new Map<string, number[]>();
let wholeWordEnabled = false;
let hebrewSearchMode: 'substring' | 'word' | 'root' = 'substring';
let updateCallback: (() => void) | null = null;
let onVerseClickCallback: ((verse: TanakhLayout) => void) | null = null;
// Track which terms have valid lemma data (for root mode visual indicators)
let termLemmaStatus: boolean[] = [];
// Track the lemmas found for each term (for root mode hover info)
let termLemmas: Array<string[] | null> = [];
// Track the Hebrew root text for each term (for legend display)
let termRoots: Array<string | null> = [];
// Track related roots for UI suggestion chips (depth-1 neighbors)
let relatedRoots: RelatedRoot[] = [];

// Incremental rendering state
const RESULTS_BATCH_SIZE = 50;
let renderedCount = 0;
let scrollHandler: (() => void) | null = null;

// DOM references (for cleanup)
let searchInput: HTMLInputElement | null = null;
let searchClear: HTMLButtonElement | null = null;
let keyboardToggle: HTMLButtonElement | null = null;
let searchResults: HTMLDivElement | null = null;
let searchHitCaption: HTMLDivElement | null = null;
let wholeWordCheckbox: HTMLInputElement | null = null;
let hebrewModeContainer: HTMLDivElement | null = null;
let documentClickHandler: ((e: MouseEvent) => void) | null = null;

export function configure(config: { verses: TanakhLayout[]; callbacks?: { onVerseClick?: (verse: TanakhLayout) => void } }): void {
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
    relatedRoots = [];
  } else {
    const isHebrew = isHebrewQuery(currentTerms[0]);

    // Check which terms have lemma data (only relevant for Hebrew root mode)
    if (isHebrew && hebrewSearchMode === 'root') {
      termLemmaStatus = [];
      termLemmas = [];
      termRoots = [];
      const allLemmasForRelated: string[] = [];
      for (const term of currentTerms) {
        const lemmas = findLemmasForWord(term);
        termLemmaStatus.push(lemmas !== null && lemmas.length > 0);
        termLemmas.push(lemmas);

        // Get the Hebrew root text for the first lemma (most relevant)
        if (lemmas && lemmas.length > 0) {
          const rootText = getRootForStrongsNumber(lemmas[0]);
          termRoots.push(rootText);
          allLemmasForRelated.push(...lemmas);
        } else {
          termRoots.push(null);
        }
      }
      // Compute related roots (depth-1 neighbors) for UI chips
      relatedRoots = getRelatedRoots(allLemmasForRelated);
    } else {
      termLemmaStatus = [];
      termLemmas = [];
      termRoots = [];
      relatedRoots = [];
    }

    // Only use wholeWord for English queries
    const useWholeWord = wholeWordEnabled && currentTerms.length > 0 && !isHebrew;
    // Pass hebrewMode for Hebrew searches
    currentResults = search(query, useWholeWord, isHebrew ? hebrewSearchMode : 'substring');
    matchingTerms = getMatchingVerseTerms(currentResults);

    // Track each search term
    const mode = isHebrew ? hebrewSearchMode : (wholeWordEnabled ? 'word' : 'substring');
    for (const term of currentTerms) {
      trackSearchExecute(term, isHebrew ? 'he' : 'en', mode, currentResults.length);
    }
  }

  renderResults();
  updateCallback?.();
}

function updateHitCaption(): void {
  if (!searchHitCaption) return;
  searchHitCaption.textContent = '';

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

      if (hebrewSearchMode === 'root' && termLemmaStatus.length > 0) {
        if (termLemmaStatus[i] && termRoots[i]) {
          termSpan.appendChild(document.createTextNode(`"${termRoots[i]}" (from "${term}")`));
        } else {
          termSpan.appendChild(document.createTextNode(`"${term}"`));
          const indicator = document.createElement('span');
          indicator.className = 'lemma-indicator';
          indicator.textContent = ' \u21AA';
          indicator.title = 'No root data, using whole-word search';
          indicator.style.color = '#FF9800';
          termSpan.appendChild(indicator);
        }
      } else {
        termSpan.appendChild(document.createTextNode(`"${term}"`));
      }

      legendDiv.appendChild(termSpan);
      if (i < currentTerms.length - 1) {
        legendDiv.appendChild(document.createTextNode(' '));
      }
    }

    // Related roots chips (only in root mode with results)
    let relatedDiv: HTMLDivElement | null = null;
    if (hebrewSearchMode === 'root' && relatedRoots.length > 0) {
      relatedDiv = document.createElement('div');
      relatedDiv.className = 'related-roots';

      const label = document.createElement('span');
      label.className = 'related-roots-label';
      label.textContent = 'Related:';
      relatedDiv.appendChild(label);

      for (const related of relatedRoots) {
        const chip = document.createElement('button');
        chip.className = 'root-chip';
        chip.textContent = related.rootText;
        chip.title = `Add "${related.surfaceForm}" to search`;
        chip.addEventListener('click', () => {
          if (searchInput) {
            const current = searchInput.value.trim();
            searchInput.value = current ? `${current},${related.surfaceForm}` : related.surfaceForm;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
        relatedDiv.appendChild(chip);
      }
    }

    const countDiv = document.createElement('div');
    countDiv.style.color = '#888';
    countDiv.style.fontSize = '11px';
    countDiv.style.marginTop = '4px';
    countDiv.textContent = `${currentResults.length} matching verses`;

    searchHitCaption.appendChild(legendDiv);
    if (relatedDiv) {
      searchHitCaption.appendChild(relatedDiv);
    }
    searchHitCaption.appendChild(countDiv);
  } else if (currentQuery.length > 0 && currentTerms.length === 0) {
    const hintDiv = document.createElement('div');
    hintDiv.style.color = '#888';
    hintDiv.style.fontSize = '11px';
    hintDiv.textContent = 'Type at least 2 characters per term';
    searchHitCaption.appendChild(hintDiv);
  } else {
    const hintDiv = document.createElement('div');
    hintDiv.style.color = '#888';
    hintDiv.style.fontSize = '11px';
    hintDiv.textContent = 'Type to search (comma-separate multiple terms)';
    searchHitCaption.appendChild(hintDiv);
  }
}

function createResultElement(result: SearchResult): HTMLDivElement {
  const div = document.createElement('div');
  div.className = 'search-result';

  // Create ref div with term indicators
  const refDiv = document.createElement('div');
  refDiv.className = 'ref';

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

  const firstMatch = result.matchingTerms[0];

  // Compute snippet on-demand if not present (for lazy evaluation in root mode)
  let snippet = firstMatch.snippet;
  let matchStart = firstMatch.matchStart;
  let matchEnd = firstMatch.matchEnd;

  if (snippet === undefined || matchStart === undefined || matchEnd === undefined) {
    const snippetData = computeSnippetForMatch(result, firstMatch.termIndex, currentTerms[firstMatch.termIndex]);
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

  const snippetContent = createHighlightedText(snippet, matchStart, matchEnd, firstMatch.termIndex);
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

  return div;
}

function appendResultsBatch(): void {
  if (!searchResults || renderedCount >= currentResults.length) return;

  const end = Math.min(renderedCount + RESULTS_BATCH_SIZE, currentResults.length);
  for (let i = renderedCount; i < end; i++) {
    searchResults.appendChild(createResultElement(currentResults[i]));
  }
  renderedCount = end;
}

function renderResults(): void {
  if (!searchResults) return;

  // Clear previous results and reset scroll state
  const existingResults = searchResults.querySelectorAll('.search-result');
  existingResults.forEach(el => el.remove());
  renderedCount = 0;

  // Remove previous scroll handler
  if (scrollHandler) {
    searchResults.removeEventListener('scroll', scrollHandler);
    scrollHandler = null;
  }

  if (currentResults.length === 0) {
    searchResults.classList.remove('visible');
    updateHitCaption();
    return;
  }

  updateHitCaption();

  // Render first batch
  appendResultsBatch();

  // Set up infinite scroll if there are more results
  if (renderedCount < currentResults.length) {
    scrollHandler = () => {
      if (!searchResults) return;
      const { scrollTop, scrollHeight, clientHeight } = searchResults;
      // Load more when within 100px of the bottom
      if (scrollHeight - scrollTop - clientHeight < 100) {
        appendResultsBatch();
      }
    };
    searchResults.addEventListener('scroll', scrollHandler);
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
 * Split text into words, treating both whitespace and maqaf (־) as separators
 * Returns array of {word, start, end} with positions in the normalized text
 */
function splitIntoWords(normalizedText: string): Array<{word: string; start: number; end: number}> {
  const words: Array<{word: string; start: number; end: number}> = [];
  let start = 0;

  while (start < normalizedText.length) {
    // Skip separators (whitespace and maqaf U+05BE)
    while (start < normalizedText.length &&
           (/\s/.test(normalizedText[start]) || normalizedText.charCodeAt(start) === 0x05BE)) {
      start++;
    }

    if (start >= normalizedText.length) break;

    // Find end of word (next separator or end of text)
    let end = start;
    while (end < normalizedText.length &&
           !(/\s/.test(normalizedText[end]) || normalizedText.charCodeAt(end) === 0x05BE)) {
      end++;
    }

    if (end > start) {
      words.push({
        word: normalizedText.slice(start, end),
        start,
        end
      });
    }

    start = end;
  }

  return words;
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
        const wordEntries = splitIntoWords(normalizedText);

        for (const {word, start} of wordEntries) {
          if (word === normalizedTerm) {
            const origStart = mapNormalizedToOriginalPosition(text, start);
            const origEnd = mapNormalizedToOriginalPosition(text, start + word.length);
            matches.push({ start: origStart, end: origEnd, termIndex });
          }
        }
      } else {
        // Match words that share the same lemmas
        const wordEntries = splitIntoWords(normalizedText);

        for (const {word, start} of wordEntries) {
          // Look up this word's lemmas
          const wordLemmas = findLemmasForWord(word);
          if (wordLemmas && wordLemmas.some(lemma => searchLemmas.includes(lemma))) {
            // This word shares a lemma with the search term
            const origStart = mapNormalizedToOriginalPosition(text, start);
            const origEnd = mapNormalizedToOriginalPosition(text, start + word.length);
            matches.push({ start: origStart, end: origEnd, termIndex });
          }
        }
      }
    } else if (isHebrew && hebrewSearchMode === 'word') {
      // Hebrew whole-word matching
      const wordEntries = splitIntoWords(normalizedText);

      for (const {word, start} of wordEntries) {
        if (word === normalizedTerm) {
          // Found a match - map to original text position
          const origStart = mapNormalizedToOriginalPosition(text, start);
          const origEnd = mapNormalizedToOriginalPosition(text, start + word.length);

          matches.push({ start: origStart, end: origEnd, termIndex });
        }
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

  getVerseColor(verse: TanakhIdentity): Color | Color[] | null {
    // No active search - use default colors
    if (currentTerms.length === 0) {
      return null;
    }

    const key = tanakhKey(verse.book, verse.chapter, verse.verse);
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

    // Dim non-matching verses to a uniform brightness that remains clearly
    // visible against the background while staying obviously deemphasized
    // relative to the matched verses (which use SEARCH_COLORS).
    const b = HIGHLIGHT_CONSTANTS.DIM_BRIGHTNESS;
    const tint = currentTheme.dust.tint;
    return tint ? [tint[0] * b, tint[1] * b, tint[2] * b] : [b, b, b];
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
      <div id="search-hit-caption"></div>
      <div id="search-results">
      </div>
    `;

    searchInput = container.querySelector('#search-input');
    searchClear = container.querySelector('#search-clear');
    keyboardToggle = container.querySelector('#keyboard-toggle');
    searchResults = container.querySelector('#search-results');
    searchHitCaption = container.querySelector('#search-hit-caption');
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
        radio.checked = radio.value === hebrewSearchMode;
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

    // Handle pasted text: strip nikkud from Hebrew, auto-switch mode on paste into empty input
    searchInput?.addEventListener('paste', (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain');
      if (!text) return;

      const input = searchInput!;
      const pasteIsHebrew = isHebrewQuery(text);
      const inputIsEmpty = input.value.length === 0;

      // Auto-switch mode when pasting into empty input
      if (inputIsEmpty) {
        if (pasteIsHebrew && !isKeyboardOpen()) {
          createHebrewKeyboard(input);
          if (keyboardToggle) keyboardToggle.classList.add('active');
          updateInputMode();
        } else if (!pasteIsHebrew && isKeyboardOpen()) {
          closeHebrewKeyboard();
          if (keyboardToggle) keyboardToggle.classList.remove('active');
          updateInputMode();
        }
      }

      // Reject paste if script doesn't match current mode (non-empty input)
      if (!inputIsEmpty) {
        const kbOpen = isKeyboardOpen();
        if (pasteIsHebrew && !kbOpen) {
          e.preventDefault();
          return;
        }
        if (!pasteIsHebrew && kbOpen) {
          e.preventDefault();
          return;
        }
      }

      // For Hebrew text, strip nikkud and insert manually
      if (pasteIsHebrew) {
        e.preventDefault();
        const stripped = stripNikkud(text);
        const start = input.selectionStart ?? 0;
        const end = input.selectionEnd ?? 0;
        const currentValue = input.value;
        input.value = currentValue.slice(0, start) + stripped + currentValue.slice(end);
        const newCursorPos = start + stripped.length;
        input.setSelectionRange(newCursorPos, newCursorPos);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      // English text: let browser handle default paste
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

      // Script enforcement: reject wrong-script chars, auto-switch on paste into empty
      const afterSanitize = input.value;
      let kbOpen = isKeyboardOpen();
      if (afterSanitize) {
        const hasHebrew = /[\u05D0-\u05EA]/.test(afterSanitize);
        const hasLatin = /[a-zA-Z]/.test(afterSanitize);

        // Auto-switch: pure wrong-script means paste into empty input — switch mode
        if (hasHebrew && !hasLatin && !kbOpen) {
          createHebrewKeyboard(input);
          if (keyboardToggle) keyboardToggle.classList.add('active');
          kbOpen = true;
        } else if (hasLatin && !hasHebrew && kbOpen) {
          closeHebrewKeyboard();
          if (keyboardToggle) keyboardToggle.classList.remove('active');
          kbOpen = false;
        }

        // Strip wrong-script characters (after potential mode switch)
        const removePattern = kbOpen ? /[a-zA-Z]/g : /[\u05D0-\u05EA]/g;
        const cleaned = afterSanitize.replace(removePattern, '');
        if (cleaned !== afterSanitize) {
          const cursor = input.selectionStart ?? afterSanitize.length;
          let removedBeforeCursor = 0;
          const charPattern = kbOpen ? /[a-zA-Z]/ : /[\u05D0-\u05EA]/;
          for (let i = 0; i < Math.min(cursor, afterSanitize.length); i++) {
            if (charPattern.test(afterSanitize[i])) {
              removedBeforeCursor++;
            }
          }
          input.value = cleaned;
          const newPos = cursor - removedBeforeCursor;
          input.setSelectionRange(newPos, newPos);
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
        searchClear!.style.display = 'none';
      }
      // Update UI to reflect current mode (keyboard open or not)
      updateInputMode();
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
          trackKeyboardToggle(false);
        } else {
          createHebrewKeyboard(searchInput);
          keyboardToggle!.classList.add('active');
          trackKeyboardToggle(true);
        }
        // Update mode selector visibility after keyboard state changes
        updateInputMode();
      }
    });
  },

  renderLegend(_container: HTMLElement): void {
    // Legend content is rendered inline above search results via updateHitCaption()
    _container.textContent = '';
    updateHitCaption();
  },

  getHoverInfo(verse: TanakhIdentity): string | null {
    if (currentTerms.length === 0) return null;

    const key = tanakhKey(verse.book, verse.chapter, verse.verse);
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
    // Clean up event listeners
    if (scrollHandler && searchResults) {
      searchResults.removeEventListener('scroll', scrollHandler);
      scrollHandler = null;
    }
    if (documentClickHandler) {
      document.removeEventListener('click', documentClickHandler);
      documentClickHandler = null;
    }
    // Clear DOM references (for memory cleanup)
    searchInput = null;
    searchClear = null;
    keyboardToggle = null;
    searchResults = null;
    searchHitCaption = null;
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

    // Restore Hebrew mode setting (default to substring if not specified)
    if (hebrewMode === 'word' || hebrewMode === 'root') {
      hebrewSearchMode = hebrewMode;
    } else {
      hebrewSearchMode = 'substring';
    }
    if (hebrewModeContainer) {
      const radioButtons = hebrewModeContainer.querySelectorAll<HTMLInputElement>('input[name="hebrew-mode"]');
      radioButtons.forEach(radio => {
        radio.checked = radio.value === hebrewSearchMode;
      });
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
