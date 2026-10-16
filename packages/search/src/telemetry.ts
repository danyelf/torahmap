// Which searched terms are worth an analytics event, and when: once the reader
// has stopped changing the search and search has its data.
import { debounce } from '@torahmap/utils';
import type { SearchTelemetry } from '@torahmap/shell/app/search.ts';
import type { SearchTerm } from './terms.ts';

/** What was last recorded for each term, by term id. */
export type Recorded = ReadonlyMap<string, string>;

/**
 * The terms among `active` that are new or whose record differs from `previous`, and the
 * record to keep afterwards: exactly the active terms, so a removed term is
 * forgotten.
 */
export function termsToRecord(
  recordOf: (term: SearchTerm) => string,
  previous: Recorded,
  active: readonly SearchTerm[],
): { send: SearchTerm[]; recorded: Recorded } {
  const recorded = new Map(active.map((term) => [term.id, recordOf(term)]));
  const send = active.filter((term) => previous.get(term.id) !== recorded.get(term.id));
  return { send, recorded };
}

/** What the telemetry asks of the search it records. */
export interface RecordedSearch<S, D> {
  /** The terms being searched. */
  active(settings: S): readonly SearchTerm[];
  /** What a term is recorded as: two terms with the same record are one search. */
  recordOf(data: D, term: SearchTerm): string;
  /** Send one term of a settled search. */
  send(data: D, settings: S, term: SearchTerm): void;
}

/** A search a link or a story stop put in place counts as already sent, and drops one waiting. */
export function searchTelemetry<S, D>(
  delayMs: number,
  search: RecordedSearch<S, D>,
): SearchTelemetry<S, D> {
  let recorded: Recorded = new Map();
  /**
   * A search that replaced the reader's, to count as sent. A term's record
   * may need search's data, so it waits for it.
   */
  let replacement: S | null = null;
  /** The reader's last change, not yet sent. */
  let waiting: S | null = null;
  let settled = false;
  let data: D | null = null;

  /** termsToRecord, building nothing while no word is typed: search's prebuild builds it. */
  function record(ready: D, previous: Recorded, active: readonly SearchTerm[]) {
    return active.length === 0
      ? { send: [], recorded: new Map() }
      : termsToRecord((term) => search.recordOf(ready, term), previous, active);
  }

  function sendIfReady(): void {
    if (!data) return;
    if (replacement) {
      recorded = record(data, new Map(), search.active(replacement)).recorded;
      replacement = null;
    }
    if (!waiting || !settled) return;
    const settings = waiting;
    waiting = null;
    const { send, recorded: next } = record(data, recorded, search.active(settings));
    recorded = next;
    for (const term of send) search.send(data, settings, term);
  }

  const settle = debounce(() => {
    settled = true;
    sendIfReady();
  }, delayMs);

  return {
    readerChanged(settings, next) {
      waiting = settings;
      settled = false;
      data = next;
      settle();
    },
    replaced(settings, next) {
      settle.cancel();
      waiting = null;
      replacement = settings;
      data = next;
      sendIfReady();
    },
    dataLoaded(next) {
      data = next;
      sendIfReady();
    },
  };
}

/** For a search that records nothing. */
export const NO_TELEMETRY: SearchTelemetry<unknown, unknown> = {
  readerChanged() {},
  replaced() {},
  dataLoaded() {},
};
