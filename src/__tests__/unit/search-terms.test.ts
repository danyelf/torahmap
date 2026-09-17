// The list of search terms.
//
// Terms have identity, so these tests are mostly about what survives an edit.
// A term addressed by its position in a re-split string loses its meaning
// selection as soon as an earlier term is edited: every later index shifts and
// the selection silently lands on a different word.

import { describe, it, expect, beforeAll } from 'vitest';
import { loadLexiconData, parseSearchTerms } from '../../search.ts';
import { meaningsInVerse } from '../../search/dictionary.ts';
import {
  addTerm,
  removeTerm,
  setTermText,
  toggleMeaning,
  selectedKeys,
  MAX_TERMS,
  encodeMeanings,
  applyMeanings,
  onlyMeaning,
  allMeanings,
  isNarrowed,
  setMode,
  effectiveMode,
  modesOffered,
  encodeModes,
  applyModes,
  type SearchTerm,
} from '../../search/terms.ts';

beforeAll(async () => {
  await loadLexiconData();
});

describe('adding a term', () => {
  it('resolves its meanings and starts with all of them selected', () => {
    const [aleh] = addTerm([], 'עלה');

    // Which meanings they are is search-dictionary.test.ts's business.
    expect(aleh.meanings.length).toBeGreaterThan(1);
    expect(aleh.selected.size).toBe(aleh.meanings.length);
  });

  it('paints the union until the reader narrows it', () => {
    const [aleh] = addTerm([], 'עלה');
    expect(selectedKeys(aleh)).toHaveLength(aleh.meanings.flatMap((m) => m.keys).length);
  });

  it('gives each term a colour no other term is using', () => {
    const terms = ['עלה', 'מלך', 'דבר'].reduce(addTerm, []);
    const colors = terms.map((t) => t.colorIndex);

    expect(new Set(colors).size).toBe(3);
  });

  it('refuses a sixth term, because a sixth colour repeats the first', () => {
    const five = ['עלה', 'מלך', 'דבר', 'ארץ', 'שמים'].reduce(addTerm, []);
    expect(five).toHaveLength(MAX_TERMS);

    expect(addTerm(five, 'אלהים')).toHaveLength(MAX_TERMS);
  });
});

describe('editing one term', () => {
  it("leaves another term's meaning selection alone", () => {
    let terms = addTerm(addTerm([], 'עלה'), 'שכם');
    const burntOffering = terms[0].meanings.find((m) => m.gloss === 'burnt-offering')!;

    // Narrow the first term, then edit the second.
    terms = toggleMeaning(terms, terms[0].id, burntOffering.keys[0]);
    const narrowedTo = selectedKeys(terms[0]).length;
    terms = setTermText(terms, terms[1].id, 'מלך');

    expect(selectedKeys(terms[0])).toHaveLength(narrowedTo);
    expect(terms[0].selected.has(burntOffering.keys[0])).toBe(false);
  });

  it('re-resolves its own meanings and selects all of them again', () => {
    let terms = addTerm([], 'עלה');
    terms = setTermText(terms, terms[0].id, 'שכם');

    expect(terms[0].meanings.map((m) => m.gloss)).toEqual(['Shechem', 'shoulder', 'Shechem']);
    expect(terms[0].selected.size).toBe(3);
  });
});

describe('removing a term', () => {
  it('does not recolour the terms that remain', () => {
    const terms = ['עלה', 'מלך', 'דבר'].reduce(addTerm, []);
    const before = new Map(terms.map((t) => [t.text, t.colorIndex]));

    const after = removeTerm(terms, terms[0].id);

    expect(after.map((t) => t.colorIndex)).toEqual([before.get('מלך'), before.get('דבר')]);
  });

  it('frees its colour for the next term added', () => {
    const three = ['עלה', 'מלך', 'דבר'].reduce(addTerm, []);
    const freed = three[0].colorIndex;

    const next = addTerm(removeTerm(three, three[0].id), 'ארץ');

    expect(next[next.length - 1].colorIndex).toBe(freed);
  });
});

describe('choosing meanings', () => {
  it('unchecks one meaning without disturbing the others', () => {
    let terms = addTerm([], 'עלה');
    const leafage = terms[0].meanings.find((m) => m.gloss === 'leafage')!;

    terms = toggleMeaning(terms, terms[0].id, leafage.keys[0]);

    expect(terms[0].selected.has(leafage.keys[0])).toBe(false);
    expect(terms[0].selected.size).toBe(4);
  });

  it('selects every lexeme behind a merged row, not just the first', () => {
    const [shechem] = addTerm([], 'שכם');
    const merged = shechem.meanings.find((m) => m.keys.length > 1)!;

    expect(selectedKeys(shechem)).toEqual(expect.arrayContaining(merged.keys));
  });

  it('refuses to uncheck the last one, which would match nothing', () => {
    let terms = addTerm([], 'עלה');
    const [first, ...rest] = terms[0].meanings;
    for (const m of rest) {
      terms = toggleMeaning(terms, terms[0].id, m.keys[0]);
    }
    expect(terms[0].selected.size).toBe(1);

    terms = toggleMeaning(terms, terms[0].id, first.keys[0]);

    expect(terms[0].selected.size).toBe(1);
  });
});

describe('carrying a narrowed search in a URL', () => {
  it('writes nothing while every meaning is still checked', () => {
    const terms = addTerm(addTerm([], 'עלה'), 'מלך');
    expect(encodeMeanings(terms)).toBe('');
  });

  it('writes only the narrowed term, leaving the other term empty', () => {
    let terms = addTerm(addTerm([], 'עלה'), 'מלך');
    const ascend = terms[0].meanings.find((m) => m.gloss === 'ascend')!;
    const kept = terms[0].meanings.filter((m) => m !== ascend).flatMap((m) => m.keys);
    terms = toggleMeaning(terms, terms[0].id, ascend.keys[0]);

    // Second term untouched, so its slot is empty and the comma still holds
    // its position.
    expect(encodeMeanings(terms)).toBe(`${kept.join('|')},`);
  });

  it('names every lexeme behind a merged row', () => {
    let terms = addTerm([], 'שכם');
    const shoulder = terms[0].meanings.find((m) => m.gloss === 'shoulder')!;
    const lastShechem = terms[0].meanings[2];
    terms = toggleMeaning(terms, terms[0].id, shoulder.keys[0]);
    terms = toggleMeaning(terms, terms[0].id, lastShechem.keys[0]);

    expect(encodeMeanings(terms)).toBe('CKM=/@heb|CKM==/@heb');
  });

  it('restores what was narrowed', () => {
    let terms = addTerm(addTerm([], 'עלה'), 'מלך');
    const ascend = terms[0].meanings.find((m) => m.gloss === 'ascend')!;
    terms = toggleMeaning(terms, terms[0].id, ascend.keys[0]);

    const restored = applyMeanings(addTerm(addTerm([], 'עלה'), 'מלך'), encodeMeanings(terms));

    expect(selectedKeys(restored[0])).toEqual(selectedKeys(terms[0]));
    expect(restored[1].selected.size).toBe(terms[1].selected.size);
  });

  it('selects a merged row when the URL names any one of its lexemes', () => {
    // A future index could group them differently; naming one should still work.
    const restored = applyMeanings(addTerm([], 'שכם'), 'CKM==/@heb');

    expect(restored[0].selected.size).toBe(1);
    expect(selectedKeys(restored[0])).toEqual(['CKM=/@heb', 'CKM==/@heb']);
  });

  it('falls back to every meaning when a key no longer resolves', () => {
    const restored = applyMeanings(addTerm([], 'עלה'), 'GONE@heb');

    expect(restored[0].selected.size).toBe(5);
  });
});

describe('a comma still means another word', () => {
  it('splits a comma-separated string into separate terms', () => {
    // The comma box is gone, but readers type commas and old URLs hold them.
    const one = addTerm([], 'x');
    const typed = setTermText(one, one[0].id, 'עלה, מלך');

    expect(typed.map((t) => t.text)).toEqual(['עלה', 'מלך']);
  });

  it("keeps the edited term's own id and colour on the first part", () => {
    const one = addTerm([], 'x');
    const typed = setTermText(one, one[0].id, 'עלה, מלך');

    expect(typed[0].id).toBe(one[0].id);
    expect(typed[0].colorIndex).toBe(one[0].colorIndex);
  });

  it('keeps the terms that were already there', () => {
    let terms = addTerm(addTerm([], 'ארץ'), 'x');
    terms = setTermText(terms, terms[1].id, 'עלה, מלך');

    expect(terms.map((t) => t.text)).toEqual(['ארץ', 'עלה', 'מלך']);
  });

  it('gives each new term its own colour', () => {
    let terms = addTerm([], 'x');
    terms = setTermText(terms, terms[0].id, 'עלה, מלך, דבר');

    expect(new Set(terms.map((t) => t.colorIndex)).size).toBe(3);
  });

  it('refuses to split past the colour limit', () => {
    let terms = addTerm([], 'x');
    terms = setTermText(terms, terms[0].id, 'a, b, c, d, e, f, g');

    expect(terms).toHaveLength(MAX_TERMS);
  });

  it('never leaves a comma inside a term, which would desync the search', () => {
    let terms = addTerm([], 'x');
    terms = setTermText(terms, terms[0].id, 'עלה, מלך');

    expect(terms.every((t) => !t.text.includes(','))).toBe(true);
  });
});

describe('showing only one meaning', () => {
  it('leaves exactly the one chosen', () => {
    let terms = addTerm([], 'עלה');
    const burntOffering = terms[0].meanings.find((m) => m.gloss === 'burnt-offering')!;

    terms = onlyMeaning(terms, terms[0].id, burntOffering.keys);

    expect(terms[0].selected.size).toBe(1);
    expect(selectedKeys(terms[0])).toEqual(['<LH/@heb']);
  });

  it('keeps every lexeme behind a merged row', () => {
    // Choosing "Shechem" means both of ETCBC's entries for it, not one.
    let terms = addTerm([], 'שכם');
    const merged = terms[0].meanings.find((m) => m.keys.length > 1)!;

    terms = onlyMeaning(terms, terms[0].id, merged.keys);

    expect(selectedKeys(terms[0])).toEqual(merged.keys);
  });

  it('finds the row by any of its lexemes, not only the one it happens to head', () => {
    // A row stands for every lexeme merged into it, and which of them comes
    // first depends on the list the row was built from. כוש in Genesis 10:7 is
    // the case: the verse offers one reading, Cush, headed by the lexeme the
    // verse contains, while the term's own list heads the same reading with
    // the other one. Matching on the head alone leaves the term selecting
    // nothing, which searches for nothing.
    const chosen = meaningsInVerse('כוש', 'Genesis:10:7')[0];
    let terms = addTerm([], 'כוש');

    terms = onlyMeaning(terms, terms[0].id, chosen.keys);

    expect(selectedKeys(terms[0])).toContain(chosen.keys[0]);
  });

  it('does not disturb another term', () => {
    let terms = addTerm(addTerm([], 'עלה'), 'מלך');
    const before = terms[1].selected.size;

    terms = onlyMeaning(terms, terms[0].id, terms[0].meanings[1].keys);

    expect(terms[1].selected.size).toBe(before);
  });
});

describe('getting back to all of them', () => {
  it('restores every meaning', () => {
    let terms = addTerm([], 'עלה');
    terms = onlyMeaning(terms, terms[0].id, terms[0].meanings[1].keys);

    terms = allMeanings(terms, terms[0].id);

    expect(terms[0].selected.size).toBe(5);
  });

  it('says whether a term is narrowed, so the control can appear', () => {
    let terms = addTerm([], 'עלה');
    expect(isNarrowed(terms[0])).toBe(false);

    terms = onlyMeaning(terms, terms[0].id, terms[0].meanings[0].keys);

    expect(isNarrowed(terms[0])).toBe(true);
  });

  it('is not narrowed when a word means only one thing', () => {
    // בראשית has one meaning, which is every meaning; nothing to restore.
    const [bereshit] = addTerm([], 'בראשית');
    expect(isNarrowed(bereshit)).toBe(false);
  });
});

// How a word is matched belongs to the word. One setting for the whole search
// matches every Hebrew term the same way, which rules out the comparisons the
// map exists to make.
describe('a term matched its own way', () => {
  it('defaults Hebrew to meanings and English to substring', () => {
    const terms = addTerm(addTerm([], 'עלה'), 'light');
    expect(effectiveMode(terms[0])).toBe('meanings');
    expect(effectiveMode(terms[1])).toBe('substring');
  });

  it('lets the default follow the text when the language changes', () => {
    // The reader has chosen nothing, so retyping an English word in Hebrew
    // should get Hebrew's default rather than the one it was created with.
    let terms = addTerm([], 'light');
    terms = setTermText(terms, terms[0].id, 'עלה');
    expect(terms[0].mode).toBeNull();
    expect(effectiveMode(terms[0])).toBe('meanings');
  });

  it('keeps a chosen mode across an edit', () => {
    let terms = addTerm([], 'עלה');
    terms = setMode(terms, terms[0].id, 'word');
    terms = setTermText(terms, terms[0].id, 'עלו');
    expect(effectiveMode(terms[0])).toBe('word');
  });

  it('holds meanings for English but does not forget it', () => {
    let terms = addTerm([], 'עלה');
    terms = setMode(terms, terms[0].id, 'meanings');
    terms = setTermText(terms, terms[0].id, 'light');
    expect(effectiveMode(terms[0])).toBe('word');
    terms = setTermText(terms, terms[0].id, 'עלה');
    expect(effectiveMode(terms[0])).toBe('meanings');
  });

  it('changes one term without touching its neighbours', () => {
    let terms = addTerm(addTerm([], 'עלה'), 'אור');
    terms = setMode(terms, terms[1].id, 'word');
    expect(effectiveMode(terms[0])).toBe('meanings');
    expect(effectiveMode(terms[1])).toBe('word');
  });

  it('offers meanings only to a term the dictionary could answer', () => {
    const terms = addTerm(addTerm([], 'עלה'), 'light');
    expect(modesOffered(terms[0])).toEqual(['substring', 'word', 'meanings']);
    expect(modesOffered(terms[1])).toEqual(['substring', 'word']);
  });
});

describe('the mode in the URL', () => {
  it('writes nothing while every term is on its default', () => {
    const terms = addTerm(addTerm([], 'עלה'), 'light');
    expect(encodeModes(terms)).toBe('');
  });

  it('writes one letter per term, empty for a term that has not chosen', () => {
    let terms = addTerm(addTerm(addTerm([], 'עלה'), 'אור'), 'light');
    terms = setMode(terms, terms[1].id, 'word');
    expect(encodeModes(terms)).toBe(',w,');
  });

  it('round-trips every mode', () => {
    let terms = addTerm(addTerm(addTerm([], 'עלה'), 'אור'), 'דבר');
    terms = setMode(terms, terms[0].id, 'substring');
    terms = setMode(terms, terms[1].id, 'word');
    terms = setMode(terms, terms[2].id, 'meanings');
    expect(encodeModes(terms)).toBe('s,w,m');

    const fresh = applyModes(addTerm(addTerm(addTerm([], 'עלה'), 'אור'), 'דבר'), 's,w,m');
    expect(fresh.map(effectiveMode)).toEqual(['substring', 'word', 'meanings']);
  });

  it('leaves a term on its default for an empty or unknown entry', () => {
    const terms = applyModes(addTerm(addTerm([], 'עלה'), 'אור'), ',zzz');
    expect(terms[0].mode).toBeNull();
    expect(terms[1].mode).toBeNull();
    expect(terms.map(effectiveMode)).toEqual(['meanings', 'meanings']);
  });

  it('ignores entries past the end of the term list', () => {
    const terms = applyModes(addTerm([], 'עלה'), 'w,r,s');
    expect(terms).toHaveLength(1);
    expect(effectiveMode(terms[0])).toBe('word');
  });

  it('stays well under the 50-character cap at five terms', () => {
    let terms: SearchTerm[] = [];
    for (const word of ['עלה', 'אור', 'דבר', 'מלך', 'ארץ']) terms = addTerm(terms, word);
    for (const term of terms) terms = setMode(terms, term.id, 'substring');
    expect(encodeModes(terms).length).toBeLessThanOrEqual(50);
  });
});

// `mode` and `m` are positional across the terms in `q`, so a term holding a
// character that `q` is later split on comes back as two terms and every later
// term's settings land one word early. Typing and parsing have to agree on
// what a separator is.
describe('typing and parsing agree on what separates two terms', () => {
  const separators = [',', '،', '‎', '״'];

  it.each(separators)('splits on %j rather than keeping it in a term', (separator) => {
    let terms = addTerm([], 'x');
    terms = setTermText(terms, terms[0].id, `אבגד${separator}הוזח`);

    expect(terms.map((t) => t.text)).toEqual(['אבגד', 'הוזח']);
  });

  it.each(separators)('round-trips a query holding %j without shifting modes', (separator) => {
    let terms = addTerm([], 'x');
    terms = setTermText(terms, terms[0].id, `אבגד${separator}הוזח`);
    terms = setMode(terms, terms[1].id, 'word');

    const query = terms.map((t) => t.text).join(', ');
    const restored = applyModes(
      parseSearchTerms(query).reduce(addTerm, [] as SearchTerm[]),
      encodeModes(terms),
    );

    expect(restored.map((t) => t.text)).toEqual(terms.map((t) => t.text));
    expect(restored.map(effectiveMode)).toEqual(terms.map(effectiveMode));
  });
});
