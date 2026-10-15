import { describe, it, expect } from 'vitest';
import { stripHtml, parseWholeRef, processTractate } from '../bundle.ts';
import { stripNikkudAndSeparators, walkMarkers } from '../markers.ts';

describe('walkMarkers', () => {
  // Real markers always carry a <big> wrap on either the marker word
  // itself or the first content word — that's the strong cue we rely on
  // to distinguish structural markers from inline Hebrew abbreviations.
  it('tags all segments after a wrapped מתני׳ marker as mishnah', () => {
    const text = [['<big><strong>מתני׳</strong></big> start', 'continuation'], ['more']];
    expect(walkMarkers(text)).toEqual([[true, true], [true]]);
  });

  it('flips to gemara on a wrapped גמ׳ marker', () => {
    const text = [
      ['<big><strong>מתני׳</strong></big> m1', '<big><strong>גמ׳</strong></big> g1'],
      ['more g'],
    ];
    expect(walkMarkers(text)).toEqual([[true, false], [false]]);
  });

  it('handles multi-perek alternation with wrapped markers', () => {
    const text = [
      ['<big><strong>מתני׳</strong></big> m1', '<big><strong>גמ׳</strong></big> g1', 'more g1'],
      ['הדרן end', '<big><strong>מתני׳</strong></big> m2', '<big><strong>גמ׳</strong></big> g2'],
    ];
    expect(walkMarkers(text)).toEqual([
      [true, false, false],
      [false, true, false],
    ]);
  });

  it('starts in gemara state (conservative default)', () => {
    expect(walkMarkers([['no marker', 'here']])).toEqual([[false, false]]);
  });

  it("requires a <big> wrap — bare unwrapped 'מתני׳' alone is NOT a marker", () => {
    // Some segments mention the abbreviation as natural Hebrew without
    // any presentational wrap. Those must NOT flip state.
    expect(walkMarkers([['מתני׳ alone with no big wrap', 'next']])).toEqual([[false, false]]);
  });

  it('ignores inline (mid-segment) marker words — they are natural Hebrew abbreviations, not structural markers', () => {
    // Real Wikisource case: Bava Metzia 6b:2 contains "מתני׳" inside a quote
    // ("Rav Hamnuna said: it's a mishnah ..."). Treating that as a marker
    // flips the state for several dapim after it.
    expect(walkMarkers([['a real gemara segment that mentions מתני׳ in passing', 'next']])).toEqual(
      [[false, false]],
    );
  });

  it('recognizes wrapped markers like <big><strong>מתני׳</strong></big>', () => {
    expect(
      walkMarkers([
        [
          '<big><strong>מתני׳</strong></big> first mishnah segment',
          'second mishnah segment',
          '<big><strong>גמ׳</strong></big> first gemara segment',
        ],
      ]),
    ).toEqual([[true, true, false]]);
  });

  it("recognizes a marker preceded by editorial '[' (Sotah 49a:17 form)", () => {
    expect(
      walkMarkers([
        [
          '<big><strong>מתני׳</strong></big> mishnah text',
          'more mishnah',
          '[<big><strong>גמ׳</strong></big> ת״ר] starts here',
        ],
      ]),
    ).toEqual([[true, true, false]]);
  });

  it('recognizes a marker wrapped in parens inside strong (Sotah 49b:4 form)', () => {
    expect(
      walkMarkers([
        [
          '<big><strong>מתני׳</strong></big> m1',
          'm1 cont',
          '<big><strong>(גמ׳)</strong></big> first gemara',
        ],
      ]),
    ).toEqual([[true, true, false]]);
  });

  it('recognizes the bare leading-marker form when the first word is wrapped', () => {
    expect(
      walkMarkers([
        [
          'מתני׳ <big><strong>הכל</strong></big> מעריכין',
          'continuation',
          'גמ׳ <big><strong>ת״ר</strong></big>',
        ],
      ]),
    ).toEqual([[true, true, false]]);
  });
});

describe('stripHtml', () => {
  it('removes <big> tags', () => {
    expect(stripHtml('<big>hello</big>')).toBe('hello');
  });

  it('removes <strong> tags', () => {
    expect(stripHtml('<strong>bold</strong> text')).toBe('bold text');
  });

  it('replaces <br/> with space', () => {
    expect(stripHtml('line1<br/>line2')).toBe('line1 line2');
    expect(stripHtml('line1<br>line2')).toBe('line1 line2');
  });

  it('preserves Hebrew text', () => {
    expect(stripHtml('<big>שלום</big>')).toBe('שלום');
  });

  it('removes <img> tags including data: URIs', () => {
    const blob = 'data:image/png;base64,' + 'A'.repeat(500);
    expect(stripHtml(`לפני <img src="${blob}" alt="x"> אחרי`)).toBe('לפני אחרי');
  });

  it('removes generic angle-bracketed tags', () => {
    expect(stripHtml('<a href="x">link</a>')).toBe('link');
    expect(stripHtml("<span class='foo'>hi</span>")).toBe('hi');
  });

  it('strips markdown link syntax', () => {
    expect(stripHtml('see [Yoma 68a](/Yoma.68a) here')).toBe('see Yoma 68a here');
  });

  it('leaves no leftover angle brackets on a real-world image segment', () => {
    const sample = 'היתה גבוהה <img src="data:image/png;base64,xyz"> ויש בה הכשר';
    const out = stripHtml(sample);
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out).toContain('היתה');
    expect(out).toContain('הכשר');
  });
});

describe('stripNikkudAndSeparators', () => {
  it('removes Hebrew vowels and cantillation marks', () => {
    expect(stripNikkudAndSeparators('שָׁלוֹם')).toBe('שלום');
    expect(stripNikkudAndSeparators('בְּרֵאשִׁית')).toBe('בראשית');
  });
  it('removes maqaf and sof pasuq', () => {
    expect(stripNikkudAndSeparators('אֶת־הָאָֽרֶץ׃')).toBe('אתהארץ');
  });
  it('leaves text without nikkud unchanged', () => {
    expect(stripNikkudAndSeparators('שלום')).toBe('שלום');
  });
});

describe('walkMarkers across two editions', () => {
  // The Davidson edition drops a bare מתני׳ before a bold first word,
  // so a chapter's opening Mishnah carries a marker only in Wikisource.
  it('takes a Mishnah marker that only the first edition has', () => {
    const wikisource = [
      ['מתני׳ <big><strong>בא</strong></big> לו', 'עוד', 'גמ׳ <big><strong>ת״ר</strong></big>'],
    ];
    const steinsaltz = [
      ['<big><strong>בָּא</strong></big> לוֹ', 'עוד', '<big><strong>גְּמָ׳</strong></big> ת״ר'],
    ];
    expect(walkMarkers(wikisource, steinsaltz)).toEqual([[true, true, false]]);
  });

  it('takes a Gemara marker that only the second edition has', () => {
    const wikisource = [['<big><strong>מתני׳</strong></big> משנה', 'ורמינהי']];
    const steinsaltz = [
      ['<big><strong>מַתְנִי׳</strong></big> משנה', '<strong><big>גְּמָ׳</big></strong> ורמינהי'],
    ];
    expect(walkMarkers(wikisource, steinsaltz)).toEqual([[true, false]]);
  });
});

describe('walkMarkers marker variants', () => {
  it('reads a marker written with an ASCII apostrophe', () => {
    const text = [
      ["<big><strong>מתני'</strong></big> משנה", 'עוד', "<big><strong>גמ'</strong></big> גמרא"],
    ];
    expect(walkMarkers(text)).toEqual([[true, true, false]]);
  });

  it('reads a marker in <b> rather than <strong>', () => {
    const text = [["<big><b>מתני'</b></big> משנה", "<big><b>גמ'</b></big> גמרא"]];
    expect(walkMarkers(text)).toEqual([[true, false]]);
  });

  it('starts the Gemara at the next segment when a bold גמ׳ ends a segment', () => {
    const text = [
      ['<big><strong>מתני׳</strong></big> משנה', 'סוף המשנה: <big><strong>גמ׳</strong></big> '],
      ['במאי עסקינן', 'עוד'],
    ];
    expect(walkMarkers(text)).toEqual([
      [true, true],
      [false, false],
    ]);
  });

  it('starts a Mishnah at a bold Hebrew numeral', () => {
    const text = [
      [
        'גמרא',
        '<big><strong>א אמר</strong></big> להם הממונה',
        'עוד',
        '<big><strong>ב</strong></big> אמר',
      ],
    ];
    expect(walkMarkers(text)).toEqual([[false, true, true, true]]);
  });

  it('keeps a Mishnah running until the next Gemara marker, however long', () => {
    const mishnah = Array.from({ length: 40 }, () => 'משנה ארוכה מאוד');
    const text = [
      [
        '<big><strong>מתני׳</strong></big> פתיחה',
        ...mishnah,
        '<big><strong>גמ׳</strong></big> גמרא',
      ],
    ];
    expect(walkMarkers(text)[0]).toEqual([true, ...mishnah.map(() => true), false]);
  });
});

describe('processTractate', () => {
  // Build a synthetic 4-amud tractate where perek 2 starts mid-amud.
  // amudIdx 0 (1a) → empty padding (matches Sefaria-Export convention)
  // amudIdx 1 (1b) → empty padding
  // amudIdx 2 (2a) → 5 segs in perek 0
  // amudIdx 3 (2b) → 4 segs total: segs 1-2 still in perek 0, segs 3-4 in perek 1
  // amudIdx 4 (3a) → 3 segs in perek 1
  function fakeWikisource() {
    return {
      heTitle: 'מסכת בדיקה',
      text: [
        [], // 1a
        [], // 1b
        ['מתני׳ a1', 'a2', 'a3', 'a4', 'a5'], // 2a
        ['b1', 'b2', 'b3', 'b4'], // 2b — boundary at segment 3
        ['c1', 'c2', 'c3'], // 3a
      ],
    };
  }
  function fakeSchema() {
    return {
      alts: {
        Chapters: {
          nodes: [
            { heTitle: 'פרק א', wholeRef: 'Test 2a:1-2b:2' },
            { heTitle: 'פרק ב', wholeRef: 'Test 2b:3-3a:3' },
          ],
        },
      },
    };
  }

  it('keeps mid-amud boundary amud in the previous perek', () => {
    const wikisource = fakeWikisource();
    const { structure } = processTractate('Zeraim', 'Test', wikisource, fakeSchema(), wikisource);
    const amud2b = structure.amudim.find((a) => a.daf === 2 && a.amud === 'b')!;
    expect(amud2b.perekIdx).toBe(0); // boundary amud belongs to prev perek
    expect(amud2b.perekBoundaryAt).toBe(2); // 0-indexed: segs [0..2)=perek 0, [2..)=perek 1
    const amud3a = structure.amudim.find((a) => a.daf === 3 && a.amud === 'a')!;
    expect(amud3a.perekIdx).toBe(1);
    expect(amud3a.perekBoundaryAt).toBeUndefined();
  });

  it('drops the empty amudim before the text starts, and keeps an empty one inside it', () => {
    const wikisource = fakeWikisource();
    wikisource.text.splice(2, 0, []); // 2a, empty: the text opens on 2b
    wikisource.text.splice(4, 0, []); // 3a, empty, inside the text
    const schema = {
      alts: { Chapters: { nodes: [{ heTitle: 'פרק א', wholeRef: 'Test 2b:1-4a:3' }] } },
    };
    const { structure, text } = processTractate('Zeraim', 'Test', wikisource, schema, wikisource);
    expect(structure.amudim.map((a) => `${a.daf}${a.amud}:${a.segmentCount}`)).toEqual([
      '2b:5',
      '3a:0',
      '3b:4',
      '4a:3',
    ]);
    expect(text.amudim.map((amud) => amud.length)).toEqual([5, 0, 4, 3]);
    expect(structure.perakim[0]).toMatchObject({ startAmudIdx: 0, endAmudIdx: 3 });
  });

  it('removes a marker word only where it is a marker', () => {
    const wikisource = fakeWikisource();
    wikisource.text[2] = [
      'מתני׳ <big><strong>הכל</strong></big> כשרים',
      "<big><strong>גמ'</strong></big> מתני׳ דלא כרבי",
      'סוף <big><strong>גמ׳</strong></big>',
      'a4',
      'a5',
    ];
    const { text } = processTractate('Zeraim', 'Test', wikisource, fakeSchema(), wikisource);
    expect(text.amudim[0].slice(0, 3)).toEqual(['הכל כשרים', 'מתני׳ דלא כרבי', 'סוף']);
  });

  it('keeps the word הדרן, in a chapter’s closing line and in running text', () => {
    const wikisource = fakeWikisource();
    wikisource.text[2] = [
      'a1',
      'והדרן אמרו',
      'a3',
      'a4',
      '<big><strong>הדרן עלך כל כתבי</strong></big>',
    ];
    const { text } = processTractate('Zeraim', 'Test', wikisource, fakeSchema(), wikisource);
    expect(text.amudim[0][1]).toBe('והדרן אמרו');
    expect(text.amudim[0][4]).toBe('הדרן עלך כל כתבי');
  });

  it('removes the marker word where only the other edition marks the segment', () => {
    const wikisource = fakeWikisource();
    wikisource.text[2] = ["מתני' סתם נזירות", "גמ' מנהני מילי", 'a3', 'a4', 'a5'];
    const merged = { text: wikisource.text.map((amud) => [...amud]) };
    merged.text[2][0] = '<big><strong>מַתְנִי׳</strong></big> סְתָם נְזִירוּת';
    merged.text[2][1] = '<big><strong>גְּמָ׳</strong></big> מְנָהָנֵי מִילֵּי';
    const { structure, text } = processTractate('Zeraim', 'Test', wikisource, fakeSchema(), merged);
    expect(text.amudim[0].slice(0, 2)).toEqual(['סתם נזירות', 'מנהני מילי']);
    expect(structure.amudim[0].mishnahMask.slice(0, 2)).toEqual([true, false]);
  });
});

describe('parseWholeRef', () => {
  it('parses a standard range ref', () => {
    expect(parseWholeRef('Berakhot 2a:1-13a:15')).toEqual({
      startDaf: 2,
      startAmud: 'a',
      startSegment: 1,
      endDaf: 13,
      endAmud: 'a',
      endSegment: 15,
    });
  });

  it('parses a ref with a multi-word tractate', () => {
    expect(parseWholeRef('Rosh Hashanah 2a:1-8b:20')).toEqual({
      startDaf: 2,
      startAmud: 'a',
      startSegment: 1,
      endDaf: 8,
      endAmud: 'b',
      endSegment: 20,
    });
  });

  it('parses a shorthand same-daf segment range', () => {
    expect(parseWholeRef('Tamid 33a:8-14')).toEqual({
      startDaf: 33,
      startAmud: 'a',
      startSegment: 8,
      endDaf: 33,
      endAmud: 'a',
      endSegment: 14,
    });
  });

  it('returns null for unparseable refs', () => {
    expect(parseWholeRef('garbage')).toBeNull();
    expect(parseWholeRef('Berakhot 2')).toBeNull();
  });
});
