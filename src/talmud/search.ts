// Shortcut: the Talmud's search finds nothing. It takes a word and says no
// segment matches, so the shell's search runs on the Talmud page, panel, link
// and Back step included, until the Talmud has a search of its own.
import type { UrlParamSpec } from '@torahmap/link';
import type { SearchTool } from '../app/search.ts';
import type { TalmudLayoutItem } from './layout.ts';

export interface TalmudSearchSettings {
  readonly text: string;
}

const URL_PARAMS = [{ key: 'search', kind: 'text' }] as const satisfies readonly UrlParamSpec[];

const BOX_ID = 'talmud-search-box';

export const talmudSearch: SearchTool<TalmudLayoutItem, TalmudSearchSettings, void> = {
  id: 'search',
  name: 'Search',
  description: 'Finds nothing yet.',

  isSearching: (settings) => settings.text.trim() !== '',

  focus() {
    document.getElementById(BOX_ID)?.focus();
  },

  recorder: { readerChanged() {}, replaced() {}, dataChanged() {} },

  getVerseColor: () => null,

  colorsFor: (items) => items.map(() => null),

  urlParams: URL_PARAMS,

  settingsFromUrl: (params) => ({ text: params.search ?? '' }),

  settingsToUrl: (settings): Record<string, string> =>
    settings.text.trim() ? { search: settings.text.trim() } : {},

  renderControls(container, settings, onChange) {
    let box = container.querySelector<HTMLInputElement>(`#${BOX_ID}`);
    if (!box) {
      container.innerHTML = `<input id="${BOX_ID}" type="search" aria-label="Search"><p></p>`;
      box = container.querySelector<HTMLInputElement>(`#${BOX_ID}`)!;
      box.addEventListener('input', () => onChange(() => ({ text: box!.value })));
    }
    if (box.value !== settings.text) box.value = settings.text;
    container.querySelector('p')!.textContent = settings.text.trim()
      ? 'No matching segments'
      : 'Type to search';
  },
};
