// What the Tanakh's search records: each settled term with its language, its
// mode and how many verses it found. When is @torahmap/search's.
import {
  activeTerms,
  searchTelemetry as recordSearches,
  type SearchCounts,
  type SearchTerm,
  type TermSettings,
} from '@torahmap/search';
import type { SearchTelemetry } from '@torahmap/shell/app/search.ts';
import { ENGLISH, HEBREW, type TextLanguage } from '@torahmap/shell/language.ts';
import { meaningsMode, termIsHebrew, type SearchMode } from './meanings.ts';
import type { SearchData } from './data.ts';

const languageOf = (term: SearchTerm): TextLanguage => (termIsHebrew(term) ? HEBREW : ENGLISH);

/** What a term is recorded as: its text, language and mode, and the meanings chosen while it is matched by them. */
export function recordOf(
  search: SearchCounts<SearchData>,
  data: SearchData,
  term: SearchTerm,
): string {
  const mode = search.modeOf(data, term);
  return JSON.stringify({
    text: term.text.trim(),
    language: languageOf(term),
    mode,
    chosen: mode === meaningsMode.id ? term.chosen : null,
  });
}

export function searchTelemetry(options: {
  delayMs: number;
  send(text: string, language: TextLanguage, mode: SearchMode, hits: number): void;
}): (search: SearchCounts<SearchData>) => SearchTelemetry<TermSettings, SearchData> {
  return (search) =>
    recordSearches<TermSettings, SearchData>(options.delayMs, {
      active: activeTerms,
      recordOf: (data, term) => recordOf(search, data, term),
      send(data, settings, term) {
        const mode = search.modeOf(data, term) as SearchMode;
        options.send(term.text, languageOf(term), mode, search.hitCount(data, settings, term)!);
      },
    });
}
