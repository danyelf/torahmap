// The Act's search: a whole English word, in any case, found in any paragraph's text.

import type { UrlParamSpec } from '@torahmap/link';
import { SEARCH_BOX_ID, type SearchTool } from '@torahmap/shell/app/search.ts';
import { CONTROL } from '@torahmap/shell/panel.ts';
import { hex } from './baseColor.ts';
import { TEXTS_FILE, type ActTexts } from './data.ts';
import type { ActItem } from './layout.ts';
import './search.css';

export interface ActSearchSettings {
  readonly text: string;
}
export interface ActSearchData {
  texts: ActTexts;
}

export const ACT_SEARCH_PARAMS = [
  { key: 'search', kind: 'text' },
] as const satisfies readonly UrlParamSpec[];

// The Tanakh's first search colour, so a search looks the same in every text.
const FOUND = hex('#1ab3cc');

const wordIn = (settings: ActSearchSettings): string => settings.text.trim();

/** A matcher for `word` as a whole word in any case; null when it has under two letters or digits. */
export function wordMatcher(word: string): RegExp | null {
  if ((word.match(/[\p{L}\p{N}]/gu) ?? []).length < 2) return null;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu');
}

function colorsFor(items: ActItem[], settings: ActSearchSettings, data: ActSearchData) {
  const matcher = wordMatcher(wordIn(settings));
  return items.map((item) => (matcher?.test(data.texts[item.id] ?? '') ? FOUND : null));
}

export const actSearch: SearchTool<ActItem, ActSearchSettings, ActSearchData> = {
  id: 'search',
  name: 'Search',
  description: 'Finds a word in any recital, article or annex.',
  data: { texts: TEXTS_FILE },

  isSearching: (settings) => wordMatcher(wordIn(settings)) !== null,
  cleared: () => ({ text: '' }),

  telemetry: { readerChanged() {}, replaced() {}, dataLoaded() {} },

  getItemColor: (item, settings, data) => colorsFor([item], settings, data)[0],
  colorsFor: (items, settings, _hovered, data) => colorsFor(items, settings, data),

  highlightItemText(_item, text, _language, settings) {
    const fragment = document.createDocumentFragment();
    const matcher = wordMatcher(wordIn(settings));
    let at = 0;
    if (matcher) {
      for (const found of text.matchAll(new RegExp(matcher.source, 'giu'))) {
        const mark = document.createElement('mark');
        mark.className = 'act-found';
        mark.textContent = found[0];
        fragment.append(text.slice(at, found.index), mark);
        at = found.index + found[0].length;
      }
    }
    fragment.append(text.slice(at));
    return fragment;
  },

  urlParams: ACT_SEARCH_PARAMS,
  settingsFromUrl: (params) => ({ text: params.search ?? '' }),
  settingsToUrl: (settings): Record<string, string> => {
    const word = wordIn(settings);
    return word ? { search: word } : {};
  },

  renderControls(container, settings, onChange, data) {
    let box = container.querySelector<HTMLInputElement>(`#${SEARCH_BOX_ID}`);
    if (!box) {
      container.innerHTML = `<input id="${SEARCH_BOX_ID}" class="${CONTROL.input}" type="search" aria-label="Search"><p></p>`;
      box = container.querySelector<HTMLInputElement>(`#${SEARCH_BOX_ID}`)!;
      box.addEventListener('input', () => onChange(() => ({ text: box!.value })));
    }
    if (box.value !== settings.text) box.value = settings.text;
    const word = wordIn(settings);
    const matcher = wordMatcher(word);
    const found =
      data && matcher ? Object.values(data.texts).filter((t) => matcher.test(t)).length : null;
    container.querySelector('p')!.textContent = !word
      ? 'Type to search'
      : found === null
        ? ''
        : `${found} matching paragraph${found === 1 ? '' : 's'}`;
  },
};
