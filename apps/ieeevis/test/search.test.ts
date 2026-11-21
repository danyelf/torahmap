import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addTerm, SEARCH_RECORD_DELAY_MS, type SearchTerm } from '@torahmap/search';
import { configureAnalytics } from '@torahmap/shell/analytics.ts';
import type { Paper, Structure } from '../src/data.ts';
import { paperOf } from '../src/layout.ts';
import { pieceEntries, visSearch } from '../src/search.ts';

const paper = (index: number, pieces: string): Paper => ({
  index,
  title: 'A Title',
  authors: ['Ana Silva'],
  kind: 'Full VIS Paper',
  when: '',
  pieces,
  page: `https://ieeevis.org/year/2026/paper/${index}`,
});
const structure: Structure = {
  days: [
    {
      name: 'Mon',
      sessions: [{ name: 'S', start: '', papers: [paper(0, 'ai'), paper(1, 'xx')] }],
    },
  ],
};
const texts = { '0.0': 'The abstract.', '0.1': 'The introduction.' };

describe('what search reads', () => {
  const entries = [...pieceEntries({ structure, texts })];
  const text = (id: string) => entries.find((e) => e.id === id)?.text.en;

  it('gives a paper’s first piece its title and authors, and no other piece', () => {
    expect(text('0.0')).toContain('A Title');
    expect(text('0.0')).toContain('Ana Silva');
    expect(text('0.1')).toBe('The introduction.');
  });

  it('leaves out a piece with no text, however the popup puts it', () => {
    expect(text('1.1')).toBeUndefined();
    expect(entries.map((e) => e.text.en).join(' ')).not.toMatch(/no text yet/i);
  });
});

describe('counting by paper', () => {
  it('puts a paper’s pieces together and keeps papers apart', () => {
    expect(paperOf('12.0')).toBe(paperOf('12.7'));
    expect(paperOf('1.10')).not.toBe(paperOf('11.0'));
  });
});

describe('what search records', () => {
  const sent: { event: string; fields: Record<string, unknown> }[] = [];
  beforeEach(() => {
    vi.useFakeTimers();
    sent.length = 0;
    configureAnalytics({
      enabled: true,
      visitId: 'v',
      send: (body) => sent.push(JSON.parse(body)),
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    configureAnalytics({ enabled: false });
  });

  it('sends the settled term with the papers it found', () => {
    const data = {
      structure,
      texts: { '0.0': 'The abstract.', '0.1': 'The introduction.' },
    };
    const terms: SearchTerm[] = addTerm([], 'introduction');
    visSearch.telemetry.readerChanged({ terms }, data);
    vi.advanceTimersByTime(SEARCH_RECORD_DELAY_MS);
    expect(sent.map((e) => [e.event, e.fields.term, e.fields.result_count])).toEqual([
      ['search_execute', 'introduction', 1],
    ]);
  });
});
