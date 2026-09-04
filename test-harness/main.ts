// Test harness for the search input flow
// Loads real data, builds real search index, renders real search overlay controls
// No WebGL, no map, no verse layout — just the input pipeline

import { loadAllVerseTexts } from '../src/verseTexts.ts';
import { buildSearchIndex, loadLemmaData } from '../src/search.ts';
import { isKeyboardOpen, createHebrewKeyboard } from '../src/hebrewKeyboard.ts';
import {
  registerAllOverlays,
  getOverlay,
  configureSearch,
} from '../src/overlays/index.ts';

// The registry is where overlays come from — fill it the way the app does.
registerAllOverlays();
const searchOverlay = getOverlay('search')!;

// --- Event log ---

const logEntries = document.getElementById('log-entries')!;
const clearLogBtn = document.getElementById('clear-log')!;

function logEvent(type: string, detail: string, isHebrew = false): void {
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="log-type">${type}</span><span class="log-detail${isHebrew ? ' log-hebrew' : ''}">${detail}</span>`;
  logEntries.prepend(entry);

  // Keep log manageable
  while (logEntries.children.length > 100) {
    logEntries.removeChild(logEntries.lastChild!);
  }
}

clearLogBtn.addEventListener('click', () => {
  logEntries.innerHTML = '';
});

// --- Status line ---

const statusFocus = document.getElementById('status-focus')!;
const statusDir = document.getElementById('status-dir')!;
const statusKeyboard = document.getElementById('status-keyboard')!;
const statusSelection = document.getElementById('status-selection')!;
const statusText = document.getElementById('status-text')!;

function updateStatus(): void {
  const input = document.getElementById('search-input') as HTMLInputElement | null;
  const focused = document.activeElement;

  // Focus
  if (focused === input) {
    statusFocus.textContent = '#search-input';
  } else if (focused?.closest('#hebrew-keyboard-container')) {
    statusFocus.textContent = 'keyboard';
  } else {
    statusFocus.textContent = focused?.id || focused?.tagName?.toLowerCase() || 'none';
  }

  // Direction
  if (input) {
    statusDir.textContent = input.dir || 'ltr';
  }

  // Keyboard state
  statusKeyboard.textContent = isKeyboardOpen() ? 'open' : 'closed';

  // Selection
  if (input) {
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    if (start === end) {
      statusSelection.textContent = `cursor@${start}`;
    } else {
      statusSelection.textContent = `${start}-${end}`;
    }

    // Current text
    const val = input.value;
    statusText.textContent = val.length > 0 ? `"${val}"` : '(empty)';
  }
}

// Poll status (handles focus, keyboard state, selection changes)
setInterval(updateStatus, 100);

// --- Wire up event logging on the search input ---

function instrumentInput(): void {
  const input = document.getElementById('search-input') as HTMLInputElement | null;
  if (!input) return;

  const esc = (s: string) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const isHeb = (s: string) => /[\u0590-\u05FF]/.test(s);

  input.addEventListener('input', () => {
    const val = input.value;
    logEvent('input', `value="${esc(val)}" dir=${input.dir} cursor=${input.selectionStart}`, isHeb(val));
  });

  input.addEventListener('paste', (e: ClipboardEvent) => {
    const text = e.clipboardData?.getData('text/plain') ?? '';
    logEvent('paste', `"${esc(text)}"`, isHeb(text));
  }, { capture: true }); // capture to log BEFORE the overlay's handler strips nikkud

  input.addEventListener('compositionstart', (e) => {
    logEvent('comp-start', `data="${esc(e.data ?? '')}"`);
  });

  input.addEventListener('compositionend', (e) => {
    logEvent('comp-end', `data="${esc((e as CompositionEvent).data ?? '')}"`);
  });

  input.addEventListener('focus', () => {
    logEvent('focus', '#search-input');
  });

  input.addEventListener('blur', () => {
    logEvent('blur', '#search-input');
  });

  input.addEventListener('keydown', (e) => {
    logEvent('keydown', `key="${e.key}" code=${e.code} prevent=${e.defaultPrevented}`);
  }, { capture: true });
}

// --- Main ---

async function main(): Promise<void> {
  document.title = 'Input Test Harness';
  logEvent('init', 'Loading data...');

  // Load data in parallel
  const [verseTexts] = await Promise.all([
    loadAllVerseTexts(),
    loadLemmaData(),
  ]);

  logEvent('init', `Loaded verse texts (${Object.keys(verseTexts).length} books)`);

  // Build search index
  buildSearchIndex(verseTexts);
  logEvent('init', 'Search index built');

  // Configure search overlay with empty verses (we don't need layout)
  configureSearch({
    verses: [],
    callbacks: {
      onVerseClick: (verse) => {
        logEvent('verse-click', `${verse.book} ${verse.chapter}:${verse.verse}`);
      },
    },
  });

  // Render search overlay controls into the controls container
  const controlsContainer = document.getElementById('overlay-controls')!;
  searchOverlay.renderControls(controlsContainer);

  // Wire up the overlay's update callback (for legend updates)
  const legendContainer = document.getElementById('overlay-legend')!;
  searchOverlay.onUpdate?.(() => {
    legendContainer.innerHTML = '';
    searchOverlay.renderLegend?.(legendContainer);
  });
  searchOverlay.renderLegend?.(legendContainer);

  // Instrument the input for event logging
  instrumentInput();

  // Auto-open Hebrew keyboard so it's always visible in the harness
  const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
  if (searchInput) {
    createHebrewKeyboard(searchInput);
    // Mark the toggle button active to stay in sync
    const toggle = document.getElementById('keyboard-toggle');
    if (toggle) toggle.classList.add('active');
  }

  logEvent('init', 'Ready — keyboard open, type to search');
}

main().catch((err) => {
  logEvent('error', String(err));
  console.error(err);
});
