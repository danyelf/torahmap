// Help modal for Torah Map
import './styles/help.css';
import { renderCreditsHtml } from './credits.ts';
import { getAllOverlays } from './overlays/registry.ts';
import { escapeHtml } from './utils/html.ts';

const STORAGE_KEY_TAB = 'torahMap.helpTab';

type TabId = 'overview' | 'controls' | 'overlays' | 'credits';

/**
 * The Overlays tab: one entry per overlay the app has registered, in the order
 * the reader meets them in the menu.
 *
 * The list is built from the registry rather than written out here, so that
 * adding an overlay adds it to the help by itself. Each overlay carries its own
 * sentence, next to the code that sentence describes; this only lays them out.
 *
 * An overlay with nothing to say is skipped rather than shown with an empty
 * description. That is a mistake, not a choice — the tests catch it, the way
 * they catch an overlay with an undeclared data source.
 */
function renderOverlayListHtml(
  overlays: readonly { name: string; description?: string }[],
): string {
  const entries = overlays
    .filter((o) => o.description)
    .map((o) => `<dt>${escapeHtml(o.name)}</dt><dd>${escapeHtml(o.description!)}</dd>`)
    .join('');

  return `<dl class="overlay-list">${entries}</dl>`;
}

const TAB_CONTENT: Record<TabId, { title: string; content: string | (() => string) }> = {
  overview: {
    title: 'Overview',
    content: `
      <h2>Torahmap</h2>
      <p>
        All 23,206 verses of the Hebrew Bible, each one a square that never moves. The story walks
        through how they are arranged.
      </p>
      <p>
        Because the squares stay put, every overlay colors the same map, and one can be held against
        another: where a word appears, how much commentary a verse has drawn, which passages are read
        as haftarah, how long the verses run.
      </p>
      <p class="credits">
        By <a href="https://danyelfisher.info" target="_blank" rel="noopener noreferrer">Danyel Fisher</a> ·
        <a href="https://github.com/danyelf/torahmap" target="_blank" rel="noopener noreferrer">GitHub</a> ·
        <button type="button" class="link-button" data-goto-tab="credits">Sources and credits</button>
      </p>
    `,
  },
  controls: {
    title: 'Controls',
    content: `
      <table class="controls-table">
        <tr><td>Scroll / Pinch</td><td>Zoom in/out</td></tr>
        <tr><td>Drag</td><td>Pan around</td></tr>
        <tr><td>Hover</td><td>Preview verse details</td></tr>
        <tr><td>Click / Tap</td><td>Pin verse details</td></tr>
        <tr><td>Click pinned / Tap again</td><td>Unpin verse</td></tr>
        <tr><td>&larr; &rarr; arrow keys</td><td>Navigate verses</td></tr>
        <tr><td>Escape</td><td>Unpin verse</td></tr>
      </table>
    `,
  },
  overlays: {
    title: 'Overlays',
    content: () => renderOverlayListHtml(getAllOverlays()),
  },
  credits: {
    title: 'Credits',
    content: () => `
      <p>Data Sources for Torahmap.</p>
      ${renderCreditsHtml(getAllOverlays())}
    `,
  },
};

let modal: HTMLDivElement | null = null;

function createModal(): HTMLDivElement {
  const container = document.createElement('div');
  container.id = 'help-modal';
  container.className = 'help-modal';
  container.innerHTML = `
    <div class="help-backdrop"></div>
    <div class="help-content">
      <div class="help-header">
        <div class="help-tabs">
          <button class="help-tab active" data-tab="overview">Overview</button>
          <button class="help-tab" data-tab="controls">Controls</button>
          <button class="help-tab" data-tab="overlays">Overlays</button>
          <button class="help-tab" data-tab="credits">Credits</button>
        </div>
        <button class="help-close">&times;</button>
      </div>
      <div class="help-body"></div>
    </div>
  `;

  // Event handlers
  const backdrop = container.querySelector('.help-backdrop') as HTMLElement;
  const closeBtn = container.querySelector('.help-close') as HTMLElement;
  const tabs = container.querySelectorAll('.help-tab');

  backdrop.addEventListener('click', hideHelp);
  closeBtn.addEventListener('click', hideHelp);

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabId = (tab as HTMLElement).dataset.tab as TabId;
      switchTab(container, tabId);
    });
  });

  // Anything inside the body is replaced whenever the tab changes, so a control
  // that switches tabs is handled here rather than bound to the element.
  const body = container.querySelector('.help-body') as HTMLElement;
  body.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest('[data-goto-tab]');
    if (target) switchTab(container, (target as HTMLElement).dataset.gotoTab as TabId);
  });

  return container;
}

function switchTab(container: HTMLElement, tabId: TabId): void {
  localStorage.setItem(STORAGE_KEY_TAB, tabId);

  // Update tab buttons
  container.querySelectorAll('.help-tab').forEach((tab) => {
    tab.classList.toggle('active', (tab as HTMLElement).dataset.tab === tabId);
  });

  // Update body content. A tab whose content depends on state gathered at
  // runtime supplies a function; the rest are plain strings.
  const body = container.querySelector('.help-body') as HTMLElement;
  const { content } = TAB_CONTENT[tabId];
  body.innerHTML = typeof content === 'function' ? content() : content;
}

function showHelp(): void {
  if (!modal) {
    modal = createModal();
    document.body.appendChild(modal);
  }

  // Restore last viewed tab
  const savedTab = localStorage.getItem(STORAGE_KEY_TAB) as TabId | null;
  const tabToShow = savedTab && TAB_CONTENT[savedTab] ? savedTab : 'overview';

  modal.classList.add('visible');
  switchTab(modal, tabToShow);
}

function hideHelp(): void {
  modal?.classList.remove('visible');
}

/** The story is the way in, so the modal never opens by itself. */
export function initHelp(footer: HTMLElement): void {
  const aboutBtn = document.createElement('button');
  aboutBtn.id = 'about-btn';
  aboutBtn.type = 'button';
  aboutBtn.className = 'footer-link';
  aboutBtn.textContent = 'About & credits';
  aboutBtn.addEventListener('click', showHelp);
  footer.appendChild(aboutBtn);
}
