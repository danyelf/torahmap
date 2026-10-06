import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { searchTelemetry, termsToRecord, type Recorded } from '../../../tanakh/search/telemetry';
import type { SearchSettings } from '../../../tanakh/search/index.ts';
import { EMPTY_DICTIONARY, searchDataFor } from '../../helpers/searchData';
import { addTerm, setMode, setTermText, type SearchTerm } from '../../../tanakh/search/terms';

const none: Recorded = new Map();

describe('termsToRecord', () => {
  it('sends a term it has not recorded', () => {
    const terms = addTerm([], 'light');
    expect(termsToRecord(EMPTY_DICTIONARY, none, terms).send).toEqual(terms);
  });

  it('does not send a term again while it is unchanged', () => {
    const terms = addTerm([], 'light');
    const { recorded } = termsToRecord(EMPTY_DICTIONARY, none, terms);
    expect(termsToRecord(EMPTY_DICTIONARY, recorded, terms).send).toEqual([]);
  });

  it('sends only the term that is new when another is already recorded', () => {
    const one = addTerm([], 'light');
    const { recorded } = termsToRecord(EMPTY_DICTIONARY, none, one);
    const two = addTerm(one, 'dark');
    expect(termsToRecord(EMPTY_DICTIONARY, recorded, two).send).toEqual([two[1]]);
  });

  it('sends a term whose text changed', () => {
    const before = addTerm([], 'light');
    const { recorded } = termsToRecord(EMPTY_DICTIONARY, none, before);
    const after = setTermText(before, before[0].id, 'lights');
    expect(termsToRecord(EMPTY_DICTIONARY, recorded, after).send).toEqual(after);
  });

  it('sends a term whose mode changed', () => {
    const before = addTerm([], 'light');
    const { recorded } = termsToRecord(EMPTY_DICTIONARY, none, before);
    const after = setMode(before, before[0].id, 'word');
    expect(termsToRecord(EMPTY_DICTIONARY, recorded, after).send).toEqual(after);
  });

  it('sends a term whose chosen meanings changed', () => {
    const [both] = addTerm([], 'עלה');
    const { recorded } = termsToRecord(EMPTY_DICTIONARY, none, [both]);
    const narrowed = { ...both, chosen: ['a'] };
    expect(termsToRecord(EMPTY_DICTIONARY, recorded, [narrowed]).send).toEqual([narrowed]);
  });

  it('does not send a term whose chosen meanings changed while it is matched by its text', () => {
    const [plain] = addTerm([], 'עלה');
    const both: SearchTerm = { ...plain, mode: 'substring' };
    const { recorded } = termsToRecord(EMPTY_DICTIONARY, none, [both]);
    const narrowed = { ...both, chosen: ['a'] };
    expect(termsToRecord(EMPTY_DICTIONARY, recorded, [narrowed]).send).toEqual([]);
  });

  it('forgets a removed term, so bringing it back sends it again', () => {
    const terms = addTerm(addTerm([], 'light'), 'dark');
    const { recorded } = termsToRecord(EMPTY_DICTIONARY, none, terms);
    const without = termsToRecord(EMPTY_DICTIONARY, recorded, [terms[0]]);
    expect(without.send).toEqual([]);
    expect([...without.recorded.keys()]).toEqual([terms[0].id]);
    expect(termsToRecord(EMPTY_DICTIONARY, without.recorded, terms).send).toEqual([terms[1]]);
  });
});

describe('searchTelemetry', () => {
  const DELAY = 1000;
  const data = searchDataFor({
    Genesis: {
      1: { 1: { he: 'א', en: 'the heavens and the earth' }, 2: { he: 'א', en: 'the heavens' } },
      2: { 1: { he: 'א', en: 'the names' } },
    },
  });
  let sent: [string, number][];
  let telemetry: ReturnType<typeof searchTelemetry>;

  const search = (...words: string[]): SearchSettings => ({ terms: words.reduce(addTerm, []) });

  beforeEach(() => {
    vi.useFakeTimers();
    sent = [];
    telemetry = searchTelemetry({
      delayMs: DELAY,
      send: (text, _language, _mode, hits) => sent.push([text, hits]),
    });
  });

  afterEach(() => vi.useRealTimers());

  it('sends a search once it has sat for the delay, with each term’s count', () => {
    telemetry.readerChanged(search('heavens'), data);
    vi.advanceTimersByTime(DELAY - 1);
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(sent).toEqual([['heavens', 2]]);
  });

  it('sends only the term added, each with its own count', () => {
    const one = search('heavens');
    telemetry.readerChanged(one, data);
    vi.advanceTimersByTime(DELAY);
    telemetry.readerChanged({ terms: addTerm(one.terms, 'names') }, data);
    vi.advanceTimersByTime(DELAY);
    expect(sent).toEqual([
      ['heavens', 2],
      ['names', 1],
    ]);
  });

  it('sends nothing for a term too short to search on', () => {
    telemetry.readerChanged(search('h'), data);
    vi.advanceTimersByTime(DELAY);
    expect(sent).toEqual([]);
  });

  it('sends a term again when how it is matched changes', () => {
    const before = search('heavens');
    telemetry.readerChanged(before, data);
    vi.advanceTimersByTime(DELAY);
    telemetry.readerChanged({ terms: setMode(before.terms, before.terms[0].id, 'word') }, data);
    vi.advanceTimersByTime(DELAY);
    expect(sent.map(([text]) => text)).toEqual(['heavens', 'heavens']);
  });

  it("does not send a link's terms when the reader adds another", () => {
    const link = search('heavens');
    telemetry.replaced(link, data);
    telemetry.readerChanged({ terms: addTerm(link.terms, 'names') }, data);
    vi.advanceTimersByTime(DELAY);
    expect(sent).toEqual([['names', 1]]);
  });

  it('drops a search a link replaces before it settles', () => {
    telemetry.readerChanged(search('hea'), data);
    telemetry.replaced(search('earth'), data);
    vi.advanceTimersByTime(DELAY);
    expect(sent).toEqual([]);
  });

  it('sends a search typed before the data once the data arrives, with its count', () => {
    telemetry.readerChanged(search('heavens'), null);
    vi.advanceTimersByTime(DELAY);
    expect(sent).toEqual([]);
    telemetry.dataLoaded(data);
    expect(sent).toEqual([['heavens', 2]]);
  });

  it('waits for the search to settle even when the data arrives first', () => {
    telemetry.readerChanged(search('heavens'), null);
    telemetry.dataLoaded(data);
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(DELAY);
    expect(sent).toEqual([['heavens', 2]]);
  });

  it("counts a link's terms as sent before the data arrives", () => {
    const link = search('heavens');
    telemetry.replaced(link, null);
    telemetry.dataLoaded(data);
    telemetry.readerChanged({ terms: addTerm(link.terms, 'names') }, data);
    vi.advanceTimersByTime(DELAY);
    expect(sent).toEqual([['names', 1]]);
  });

  it('builds no dictionary while no word is typed', () => {
    const unbuildable = { ...data, lexicon: {} as typeof data.lexicon };
    const empty = { terms: addTerm([], '') };
    expect(() => {
      telemetry.replaced(empty, unbuildable);
      telemetry.dataLoaded(unbuildable);
      telemetry.readerChanged(empty, unbuildable);
      vi.advanceTimersByTime(DELAY);
    }).not.toThrow();
  });

  it("counts a link's terms as sent when the reader adds one before the data arrives", () => {
    const link = search('heavens');
    telemetry.replaced(link, null);
    telemetry.readerChanged({ terms: addTerm(link.terms, 'names') }, null);
    vi.advanceTimersByTime(DELAY);
    telemetry.dataLoaded(data);
    expect(sent).toEqual([['names', 1]]);
  });
});
