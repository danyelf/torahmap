// What the Tanakh's search records: each settled term with its language, its
// mode and how many verses it found. When is @torahmap/search's.
import {
  activeTerms,
  searchTelemetry as recordSearches,
  termsToRecord as termsToRecordBy,
  type Recorded,
  type SearchTerm,
} from '@torahmap/search';
import type { SearchTelemetry } from '@torahmap/shell/app/search.ts';
import type { TextLanguage } from '@torahmap/shell/language.ts';
import { termQuery, type SearchMode } from './meanings.ts';
import type { Dictionary } from './search.ts';
import { dictionaryOf, type SearchData } from './data.ts';
import { termHitCount, type SearchSettings } from './index.ts';

export type { Recorded };

/** What a term is recorded as: its query, with the meanings as chosen rather than looked up. */
function recordOf(dictionary: Dictionary, term: SearchTerm): string {
  const { text, language, mode } = termQuery(dictionary, term);
  // Chosen meanings narrow a term only while it is matched by its meanings.
  return JSON.stringify({ text, language, mode, chosen: mode === 'meanings' ? term.chosen : null });
}

/** The terms among `active` that are new or whose record differs from `previous`. */
export function termsToRecord(
  dictionary: Dictionary,
  previous: Recorded,
  active: readonly SearchTerm[],
): { send: SearchTerm[]; recorded: Recorded } {
  return termsToRecordBy((term) => recordOf(dictionary, term), previous, active);
}

export function searchTelemetry(options: {
  delayMs: number;
  send(text: string, language: TextLanguage, mode: SearchMode, hits: number): void;
}): SearchTelemetry<SearchSettings, SearchData> {
  return recordSearches<SearchSettings, SearchData>(options.delayMs, {
    active: activeTerms,
    recordOf: (data, term) => recordOf(dictionaryOf(data), term),
    send(data, settings, term) {
      const { language, mode } = termQuery(dictionaryOf(data), term);
      options.send(term.text, language, mode, termHitCount(data, settings, term)!);
    },
  });
}
