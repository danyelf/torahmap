// Help modal for Torah Map
import './styles/help.css';

const STORAGE_KEY_SEEN = 'torahMap.helpSeen';
const STORAGE_KEY_TAB = 'torahMap.helpTab';

type TabId = 'overview' | 'controls' | 'overlays';

const TAB_CONTENT: Record<TabId, { title: string; content: string }> = {
  overview: {
    title: 'Overview',
    content: `
      <h2>Torah Map</h2>
      <p>An interactive visualization of the entire Tanakh (Hebrew Bible) where every verse has a fixed position.</p>
      <p>The map is divided into three sections, stacked vertically:</p>
      <ul>
        <li><strong>Torah</strong> — The Five Books of Moses</li>
        <li><strong>Nevi'im</strong> — The Prophets</li>
        <li><strong>Ketuvim</strong> — The Writings</li>
      </ul>
      <p>Switch between different analytical overlays to reveal patterns across 23,000+ verses.</p>
      <p class="credits">
        By <a href="https://danyelfisher.info" target="_blank">Danyel Fisher</a> ·
        <a href="https://github.com/danyelf/torahmap" target="_blank">GitHub</a> ·
        Data from <a href="https://www.sefaria.org/" target="_blank">Sefaria</a>
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
    content: `
      <dl class="overlay-list">
        <dt>Text Search</dt>
        <dd>Search Hebrew or English text. Matching verses are highlighted on the map.</dd>

        <dt>Commentary</dt>
        <dd>Heatmap showing commentary density from Sefaria. Filter by source type.</dd>

        <dt>Trop</dt>
        <dd>Visualize cantillation marks (trope). Select a mark to see where it appears.</dd>
      </dl>
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

  return container;
}

function switchTab(container: HTMLElement, tabId: TabId): void {
  localStorage.setItem(STORAGE_KEY_TAB, tabId);

  // Update tab buttons
  container.querySelectorAll('.help-tab').forEach((tab) => {
    tab.classList.toggle('active', (tab as HTMLElement).dataset.tab === tabId);
  });

  // Update body content
  const body = container.querySelector('.help-body') as HTMLElement;
  body.innerHTML = TAB_CONTENT[tabId].content;
}

export function showHelp(): void {
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

export function hideHelp(): void {
  if (modal) {
    modal.classList.remove('visible');
    localStorage.setItem(STORAGE_KEY_SEEN, 'true');
  }
}

export function initHelp(controlsPanel: HTMLElement): void {
  // Add help button to controls panel
  const helpBtn = document.createElement('button');
  helpBtn.id = 'help-btn';
  helpBtn.textContent = '?';
  helpBtn.title = 'How to use';
  helpBtn.addEventListener('click', showHelp);
  controlsPanel.appendChild(helpBtn);

  // Show on first visit
  if (!localStorage.getItem(STORAGE_KEY_SEEN)) {
    showHelp();
  }
}
