import { describe, it, expect, vi } from 'vitest';
import {
  eachWord,
  namedBy,
  nameTable,
  placeCompleter,
  referenceReader,
  referenceTokens,
  type Token,
} from '../src/references.ts';

const texts = (tokens: Token[]) => tokens.map((t) => t.text);

describe('referenceTokens', () => {
  it('splits on spaces, colons and full stops', () => {
    expect(texts(referenceTokens('I Samuel 3:17'))).toEqual(['i', 'samuel', '3', '17']);
    expect(texts(referenceTokens('I Sam. 3.17'))).toEqual(['i', 'sam', '3', '17']);
    expect(texts(referenceTokens('  1 Samuel   3 17 '))).toEqual(['1', 'samuel', '3', '17']);
  });

  it('splits where digits meet letters', () => {
    expect(texts(referenceTokens('1Sam3:17'))).toEqual(['1', 'sam', '3', '17']);
    expect(texts(referenceTokens('Ber. 3b4'))).toEqual(['ber', '3', 'b', '4']);
  });

  it('keeps the full stop or colon that follows a token', () => {
    const tokens = referenceTokens('ברכות ג: ד.');
    expect(tokens).toEqual([
      { text: 'ברכות', mark: '' },
      { text: 'ג', mark: ':' },
      { text: 'ד', mark: '.' },
    ]);
  });

  it('gives a dash a token of its own, for a range', () => {
    expect(texts(referenceTokens('Gen 1:1-5'))).toEqual(['gen', '1', '1', '-', '5']);
    expect(texts(referenceTokens('Gen 1:1 – 2:3'))).toEqual(['gen', '1', '1', '-', '2', '3']);
  });

  it('splits on brackets and commas', () => {
    expect(texts(referenceTokens('Art. 5(1)(h)'))).toEqual(['art', '5', '1', 'h']);
    expect(texts(referenceTokens('Isaiah 40, 1'))).toEqual(['isaiah', '40', '1']);
  });

  it('gives nothing for nothing', () => {
    expect(referenceTokens('')).toEqual([]);
    expect(referenceTokens(' :. ')).toEqual([]);
  });
});

const PLACES = [
  { key: 'north gate', names: ['North Gate', 'NG'] },
  { key: 'north', names: ['North'] },
  { key: 'northwick', names: ['Northwick'] },
  { key: 'south', names: ['South'] },
  { key: 'southampton', names: ['Southampton', 'Soton'] },
];

describe('nameTable.read', () => {
  const places = nameTable(PLACES);
  const read = (typed: string) => {
    const found = places.read(referenceTokens(typed));
    return found && { key: found.key, rest: texts(found.rest) };
  };

  it('reads a name in full, in any case, and the tokens after it', () => {
    expect(read('Northwick 1 2')).toEqual({ key: 'northwick', rest: ['1', '2'] });
    expect(read('SOUTH')).toEqual({ key: 'south', rest: [] });
  });

  it('reads the start of a name when only one name starts that way', () => {
    expect(read('Northw 3')?.key).toBe('northwick');
    expect(read('Southa')?.key).toBe('southampton');
  });

  it('reads a whole name before the start of a longer one', () => {
    expect(read('South 3')?.key).toBe('south');
  });

  it('reads the longest name it can, so a name of several words is not cut short', () => {
    expect(read('North Gate 2')).toEqual({ key: 'north gate', rest: ['2'] });
    expect(read('North 2')).toEqual({ key: 'north', rest: ['2'] });
  });

  it('reads nothing where several names start the same way', () => {
    expect(read('Nor 3')).toBeNull();
  });

  it('never reads a single letter as a name', () => {
    expect(read('S 3')).toBeNull();
  });

  it('reads any of the names an entry is given', () => {
    expect(read('NG 2')).toEqual({ key: 'north gate', rest: ['2'] });
    expect(read('Soton')?.key).toBe('southampton');
  });

  it('reads nothing that names nothing', () => {
    expect(read('East 1')).toBeNull();
    expect(read('3 17')).toBeNull();
    expect(read('')).toBeNull();
  });

  it('tries the later folds only on the names given as spellings', () => {
    const folds = [eachWord((word) => word), eachWord((word) => word.replace(/ou/g, 'u'))];
    const asWritten = nameTable([{ key: 'south', names: ['South'] }], folds);
    expect(asWritten.read(referenceTokens('Suth 1'))).toBeNull();
    const spelled = nameTable([{ key: 'south', names: ['South'], spellings: ['South'] }], folds);
    expect(spelled.read(referenceTokens('Suth 1'))?.key).toBe('south');
    expect(spelled.complete('sou')).toEqual(['South']);
  });

  it('tries the later folds only on three letters or more', () => {
    const folds = [eachWord((word) => word), eachWord((word) => word.replace(/ou/g, 'u'))];
    const spelled = nameTable([{ key: 'south', names: ['South'], spellings: ['South'] }], folds);
    expect(spelled.read(referenceTokens('Su 1'))).toBeNull();
    expect(spelled.read(referenceTokens('Sut 1'))?.key).toBe('south');
    expect(spelled.read(referenceTokens('So 1'))?.key).toBe('south');
  });
});

describe('nameTable.complete', () => {
  const { complete } = nameTable(PLACES);

  it('offers each name that starts as typed, in order, in any case', () => {
    expect(complete('NO')).toEqual(['North Gate', 'North', 'Northwick']);
    expect(complete('sou')).toEqual(['South', 'Southampton']);
  });

  it('offers a name when a later word of it starts as typed', () => {
    expect(complete('gate')).toEqual(['North Gate']);
    expect(complete('ton')).toEqual([]);
  });

  it('offers an entry once, by its first name that starts as typed', () => {
    expect(complete('so')).toEqual(['South', 'Southampton']);
    expect(complete('sot')).toEqual(['Soton']);
  });

  it('offers nothing for an entry once one of its names is typed in full', () => {
    expect(complete('North')).toEqual(['North Gate', 'Northwick']);
    expect(complete('Northwick')).toEqual([]);
  });

  it('offers nothing once numbers follow the name, or for nothing', () => {
    expect(complete('North 4')).toEqual([]);
    expect(complete(' ')).toEqual([]);
  });

  it('goes by the first fold alone', () => {
    const spoken = nameTable(PLACES, [
      eachWord((word) => word),
      eachWord((word) => word.replace(/ou/g, 'u')),
    ]);
    expect(spoken.complete('Su')).toEqual([]);
  });
});

describe('referenceReader', () => {
  const where = vi.fn((key: string, rest: Token[]) =>
    rest.length > 1 ? null : { ref: `${key} ${texts(rest).join('')}`.trim(), ids: [key] },
  );
  const reader = referenceReader({
    named: PLACES,
    filler: new Set(['gate', 'no']),
    place: where,
    unnamed: (tokens) => (texts(tokens).join('') === '7' ? { ref: 'Seven', ids: ['7'] } : null),
  });

  it('reads what was typed as the text cleans it, names included', () => {
    const cleaned = referenceReader({
      named: [{ key: 'south', names: ["Sou'th"] }],
      place: (key) => ({ ref: key, ids: [key] }),
      clean: (typed) => typed.replace(/'/g, ''),
    });
    expect(cleaned.read('South')?.ids).toEqual(['south']);
    expect(cleaned.read("So'uth")?.ids).toEqual(['south']);
    expect(cleaned.completeNames('so')).toEqual(["Sou'th"]);
    const uncleaned = referenceReader({
      named: PLACES,
      place: (key) => ({ ref: key, ids: [key] }),
    });
    expect(uncleaned.read("So'uth")).toBeNull();
  });

  it('reads the place the tokens after a name give, filler gone', () => {
    expect(reader.read('South no 3')).toEqual({ ref: 'south 3', ids: ['south'] });
    expect(where).toHaveBeenLastCalledWith('south', [{ text: '3', mark: '' }]);
  });

  it('reads tokens that begin with no name as the text says', () => {
    expect(reader.read('7')).toEqual({ ref: 'Seven', ids: ['7'] });
    expect(reader.read('East 1')).toBeNull();
  });

  it('completes from the same names it reads', () => {
    expect(reader.completeNames('sou')).toEqual(['South', 'Southampton']);
  });
});

describe('placeCompleter', () => {
  const PLACE_LIST = ['Gate 1', 'Gate 2', 'Gate 12', 'Tower 1', 'Tower 4a'];
  const complete = placeCompleter(PLACE_LIST);

  it('offers the places each of whose words starts as the typed word in its place does, in order', () => {
    expect(complete('g')).toEqual(['Gate 1', 'Gate 2', 'Gate 12']);
    expect(complete('GATE 1')).toEqual(['Gate 12']);
    expect(complete('tow 4')).toEqual(['Tower 4a']);
  });

  it('offers no place already typed in full', () => {
    expect(complete('Gate 2')).toEqual([]);
  });

  it('cleans the places and what is typed as the text says', () => {
    const cleaned = placeCompleter(["Ga'te 1", 'Gate 2'], (text) => text.replace(/'/g, ''));
    expect(cleaned("g'a")).toEqual(["Ga'te 1", 'Gate 2']);
    expect(cleaned('gate 1')).toEqual([]);
  });

  it('offers nothing for nothing, or for what starts no place', () => {
    expect(complete(' ')).toEqual([]);
    expect(complete('wall')).toEqual([]);
    expect(complete('gate 1 2')).toEqual([]);
  });
});

describe('namedBy', () => {
  it('names a key by each group in order, marking the groups that are spellings', () => {
    expect(
      namedBy('south', [
        { names: ['South'] },
        { names: ['Sooth', 'Suth'], spelled: true },
        { names: undefined },
        { names: ['S.'] },
      ]),
    ).toEqual({
      key: 'south',
      names: ['South', 'Sooth', 'Suth', 'S.'],
      spellings: ['Sooth', 'Suth'],
    });
  });
});
