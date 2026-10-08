// Shortcut: the Talmud's search finds nothing. It takes a word and says no
// segment matches, so the shell's search runs on the Talmud page, panel, link
// and Back step included, until the Talmud has a search of its own.
import type { UrlParamSpec } from '@torahmap/link';
import { SEARCH_BOX_ID, type SearchTool } from '../app/search.ts';
import type { TalmudLayoutItem } from './layout.ts';

export interface TalmudSearchSettings {
  readonly text: string;
}

export const TALMUD_SEARCH_PARAMS = [
  { key: 'search', kind: 'text' },
] as const satisfies readonly UrlParamSpec[];

const wordIn = (settings: TalmudSearchSettings): string => settings.text.trim();

export const talmudSearch: SearchTool<TalmudLayoutItem, TalmudSearchSettings, void> = {
  id: 'search',
  name: 'Search',
  description: 'Finds nothing yet.',

  isSearching: (settings) => wordIn(settings) !== '',

  telemetry: { readerChanged() {}, replaced() {}, dataLoaded() {} },

  getVerseColor: () => null,

  colorsFor: (items) => items.map(() => null),

  urlParams: TALMUD_SEARCH_PARAMS,

  settingsFromUrl: (params) => ({ text: params.search ?? '' }),

  settingsToUrl: (settings): Record<string, string> => {
    const word = wordIn(settings);
    return word ? { search: word } : {};
  },

  renderControls(container, settings, onChange) {
    let box = container.querySelector<HTMLInputElement>(`#${SEARCH_BOX_ID}`);
    if (!box) {
      container.innerHTML = `<input id="${SEARCH_BOX_ID}" type="search" aria-label="Search"><p></p>`;
      box = container.querySelector<HTMLInputElement>(`#${SEARCH_BOX_ID}`)!;
      box.addEventListener('input', () => onChange(() => ({ text: box!.value })));
    }
    if (box.value !== settings.text) box.value = settings.text;
    container.querySelector('p')!.textContent = wordIn(settings)
      ? 'No matching segments'
      : 'Type to search';
  },
};
