// Test harness for the search input flow
// Loads search's real files and renders the real search controls
// No WebGL, no map, no verse layout — just the input pipeline

import { dataFor, loadFiles, overlayFiles } from '../src/dataFiles.ts';
import { isHebrew } from '../src/hebrew.ts';
import { createOverlaySettings } from '../src/overlays/index.ts';
import { configure as configureSearch } from '../src/tanakh/search/index.ts';
import { searchTool as searchOverlay } from '../src/tanakh/search/index.ts';

// --- Event log ---

const logEntries = document.getElementById('log-entries')!;
const clearLogBtn = document.getElementById('clear-log')!;

function logEvent(type: string, detail: string, hebrew = false): void {
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="log-type">${type}</span><span class="log-detail${hebrew ? ' log-hebrew' : ''}">${detail}</span>`;
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
const statusSelection = document.getElementById('status-selection')!;
const statusText = document.getElementById('status-text')!;

function updateStatus(): void {
  const input = document.getElementById('search-input') as HTMLInputElement | null;
  const focused = document.activeElement;

  // Focus
  if (focused === input) {
    statusFocus.textContent = '#search-input';
  } else {
    statusFocus.textContent = focused?.id || focused?.tagName?.toLowerCase() || 'none';
  }

  // Direction
  if (input) {
    statusDir.textContent = input.dir || 'ltr';
  }

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

// Poll status (handles focus, direction, selection changes)
setInterval(updateStatus, 100);

// --- Wire up event logging on the search input ---

function instrumentInput(): void {
  const input = document.getElementById('search-input') as HTMLInputElement | null;
  if (!input) return;

  const esc = (s: string) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  input.addEventListener('input', () => {
    const val = input.value;
    logEvent(
      'input',
      `value="${esc(val)}" dir=${input.dir} cursor=${input.selectionStart}`,
      isHebrew(val),
    );
  });

  input.addEventListener(
    'paste',
    (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain') ?? '';
      logEvent('paste', `"${esc(text)}"`, isHebrew(text));
    },
    { capture: true },
  ); // capture to log BEFORE the overlay's handler strips nikkud

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

  input.addEventListener(
    'keydown',
    (e) => {
      logEvent('keydown', `key="${e.key}" code=${e.code} prevent=${e.defaultPrevented}`);
    },
    { capture: true },
  );
}

// --- Main ---

async function main(): Promise<void> {
  document.title = 'Input Test Harness';
  logEvent('init', 'Loading data...');

  const loaded = await loadFiles(overlayFiles([searchOverlay]));
  const data = dataFor(searchOverlay, loaded);
  logEvent('init', data ? 'Search data loaded' : 'Search data missing: see the console');

  // Configure search overlay with empty verses (we don't need layout)
  configureSearch({
    verses: [],
    callbacks: {
      onVerseClick: (verse) => {
        logEvent('verse-click', `${verse.book} ${verse.chapter}:${verse.verse}`);
      },
    },
  });

  // Hold the search's settings the way the app does, and draw the controls again
  // after every change.
  const controlsContainer = document.getElementById('search-controls')!;
  const settings = createOverlaySettings();

  function draw(): void {
    searchOverlay.renderControls?.(
      controlsContainer,
      settings.get(searchOverlay),
      (update) => {
        settings.set(searchOverlay, update(settings.get(searchOverlay)));
        draw();
      },
      data,
    );
  }
  draw();

  // Instrument the input for event logging
  instrumentInput();

  logEvent('init', 'Ready — type to search');
}

main().catch((err) => {
  logEvent('error', String(err));
  console.error(err);
});
