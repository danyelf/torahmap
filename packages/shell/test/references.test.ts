import { describe, it, expect } from 'vitest';
import { nameReader, referenceTokens, type Token } from '../src/references.ts';

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

  it('drops quotes, geresh, gershayim and points inside a token', () => {
    expect(texts(referenceTokens('ע״א'))).toEqual(['עא']);
    expect(texts(referenceTokens("Ta'anit"))).toEqual(['taanit']);
    expect(texts(referenceTokens('שְׁמוֹת'))).toEqual(['שמות']);
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

describe('nameReader', () => {
  const books = nameReader([
    { key: 'Genesis', names: ['Genesis', 'בראשית', 'Bereshit'] },
    { key: 'Exodus', names: ['Exodus', 'שמות'] },
    { key: 'Joshua', names: ['Joshua', 'יהושע'] },
    { key: 'Job', names: ['Job', 'איוב'] },
    { key: 'Joel', names: ['Joel', 'יואל'] },
    { key: 'I Samuel', names: ['I Samuel', 'שמואל א'] },
    { key: 'II Samuel', names: ['II Samuel', 'שמואל ב'] },
    { key: 'I Kings', names: ['I Kings', 'מלכים א', '1 Kgs'] },
    { key: 'Song of Songs', names: ['Song of Songs', 'שיר השירים'] },
    { key: 'Deuteronomy', names: ['Deuteronomy', 'דברים'] },
    { key: 'I Chronicles', names: ['I Chronicles', 'דברי הימים א'] },
  ]);
  const read = (typed: string) => {
    const found = books(referenceTokens(typed));
    return found && { key: found.key, rest: texts(found.rest) };
  };

  it('reads a name in full, in any case', () => {
    expect(read('Genesis 1 1')).toEqual({ key: 'Genesis', rest: ['1', '1'] });
    expect(read('GENESIS')).toEqual({ key: 'Genesis', rest: [] });
    expect(read('בראשית א')).toEqual({ key: 'Genesis', rest: ['א'] });
  });

  it('reads the start of a name when only one name starts that way', () => {
    expect(read('Gen 3')?.key).toBe('Genesis');
    expect(read('Ex')?.key).toBe('Exodus');
    expect(read('Song 2')?.key).toBe('Song of Songs');
    expect(read('Josh')?.key).toBe('Joshua');
  });

  it('reads a whole name before the start of a longer one', () => {
    expect(read('Job 3')?.key).toBe('Job');
  });

  it('reads nothing where several names start the same way', () => {
    expect(read('Jo 3')).toBeNull();
    expect(read('Samuel 3')).toBeNull();
    expect(read('שמואל ג')).toBeNull();
  });

  it('never reads a single letter as a name', () => {
    expect(read('G 3')).toBeNull();
    expect(read('1 S 3')).toBeNull();
  });

  it('reads a book number as a digit or a Roman numeral, with or without a space', () => {
    for (const typed of ['I Samuel 3', '1 Samuel 3', '1Samuel 3', '1 Sam 3', 'i sam. 3', '1Sam3']) {
      expect(read(typed)).toEqual({ key: 'I Samuel', rest: ['3'] });
    }
    expect(read('II Sam 3')?.key).toBe('II Samuel');
  });

  it('reads the longest name it can, so a Hebrew book number is not taken as a chapter', () => {
    expect(read('שמואל א ג:יז')).toEqual({ key: 'I Samuel', rest: ['ג', 'יז'] });
    expect(read('שמואל ב')).toEqual({ key: 'II Samuel', rest: [] });
    expect(read('דברי הימים א ב')).toEqual({ key: 'I Chronicles', rest: ['ב'] });
    expect(read('דברים א')).toEqual({ key: 'Deuteronomy', rest: ['א'] });
  });

  it('reads Hebrew written with final letters or without', () => {
    expect(read('דברימ')?.key).toBe('Deuteronomy');
  });

  it('reads any of the names an entry is given', () => {
    expect(read('1 Kgs 17')).toEqual({ key: 'I Kings', rest: ['17'] });
    expect(read('Bereshit 1')?.key).toBe('Genesis');
  });

  it('reads nothing that names nothing', () => {
    expect(read('Matthew 1')).toBeNull();
    expect(read('3 17')).toBeNull();
    expect(read('')).toBeNull();
  });

  describe('spellings', () => {
    const tractates = nameReader([
      { key: 'Berakhot', names: ['Berakhot', 'ברכות'] },
      { key: 'Shabbat', names: ['Shabbat', 'שבת'] },
      { key: 'Pesachim', names: ['Pesachim', 'פסחים'] },
      { key: 'Chullin', names: ['Chullin', 'חולין'] },
      { key: 'Kiddushin', names: ['Kiddushin', 'קידושין'] },
      { key: 'Sukkah', names: ['Sukkah', 'סוכה'] },
      { key: 'Bava Kamma', names: ['Bava Kamma', 'בבא קמא', 'BK'] },
      { key: 'Bava Metzia', names: ['Bava Metzia', 'בבא מציעא', 'BM'] },
      { key: 'Beitzah', names: ['Beitzah', 'ביצה'] },
      { key: 'Megillah', names: ['Megillah', 'מגילה'] },
      { key: 'Taanit', names: ['Taanit', 'תענית'] },
    ]);
    const key = (typed: string) => tractates(referenceTokens(typed))?.key ?? null;

    it('reads a name spelled as it is often transliterated', () => {
      expect(key('Brachot')).toBe('Berakhot');
      expect(key('Berachos')).toBe('Berakhot');
      expect(key('Shabbos')).toBe('Shabbat');
      expect(key('Pesahim')).toBe('Pesachim');
      expect(key('Hullin')).toBe('Chullin');
      expect(key('Qiddushin')).toBe('Kiddushin');
      expect(key('Succah')).toBe('Sukkah');
      expect(key('Suka')).toBe('Sukkah');
      expect(key('Baba Kama')).toBe('Bava Kamma');
      expect(key('Betzah')).toBe('Beitzah');
      expect(key('Megila')).toBe('Megillah');
      expect(key("Ta'anis")).toBe('Taanit');
    });

    it('reads a Hebrew name spelled with or without its vowel letters', () => {
      expect(key('חלין')).toBe('Chullin');
      expect(key('קדושין')).toBe('Kiddushin');
    });

    it('reads the start of a two-word name', () => {
      expect(key('Bava K')).toBe('Bava Kamma');
      expect(key('Bava')).toBeNull();
    });

    it('reads an abbreviation given as a name, with or without its full stops', () => {
      expect(key('BK')).toBe('Bava Kamma');
      expect(key('B.K.')).toBe('Bava Kamma');
      expect(key('b m')).toBe('Bava Metzia');
    });
  });
});
