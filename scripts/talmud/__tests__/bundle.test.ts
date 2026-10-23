import { describe, it, expect } from 'vitest';
import { stripHtml, parseWholeRef, processTractate } from '../bundle.ts';
import { stripNikkudAndSeparators, walkMarkers } from '../markers.ts';

describe('walkMarkers', () => {
  it('tags every segment from a מתני׳ to the next גמ׳ as Mishnah', () => {
    const text = [
      ['<big><strong>מַתְנִי׳</strong></big> מִשְׁנָה', 'עוֹד'],
      ['<strong><big>גְּמָ׳</big></strong> גְּמָרָא', 'עוֹד'],
    ];
    expect(walkMarkers(text)).toEqual([
      [true, true],
      [false, false],
    ]);
  });

  it('starts in the Gemara', () => {
    expect(walkMarkers([['no marker', 'here']])).toEqual([[false, false]]);
  });

  it('reads a marker word that opens a segment, bold or bare, after brackets or before bold words', () => {
    const text = [
      [
        'מַתְנִי׳ <strong><big>הַכֹּל</big></strong> מַעֲרִיכִין',
        'גְּמָ׳: מַתְנִיתִין דְּלָא כְּרַבִּי יְהוּדָה',
        '[<big><strong>מתני׳</strong></big>] משנה',
        "<big><b>גמ'</b></big>, ורבנן",
      ],
    ];
    expect(walkMarkers(text)).toEqual([[true, false, true, false]]);
  });

  it('ignores a marker word in running text, or the start of a longer word', () => {
    const text = [
      ['<big><strong>מתני׳</strong></big> משנה', 'אמר רב: מתני׳ מני', 'מַתְנִיתִין מַנִּי'],
    ];
    expect(walkMarkers(text)).toEqual([[true, true, true]]);
  });

  it('starts a Mishnah at bold opening words, after a quote mark too', () => {
    const text = [
      [
        'גמרא',
        '<big><strong>מֵאֵימָתַי</strong></big> קוֹרִין',
        '<big><strong>גמ׳</strong></big> גמרא',
        '״<big><strong>קוֹנָם יַיִן</strong></big> שֶׁאֲנִי טוֹעֵם״',
      ],
    ];
    expect(walkMarkers(text)).toEqual([[false, true, false, true]]);
  });

  it('starts a Mishnah after a chapter’s closing line, which is no Mishnah itself', () => {
    const text = [
      [
        '<big><strong>מתני׳</strong></big> משנה',
        '<big><strong>גמ׳</strong></big> גמרא',
        '<br><br><big><strong>הַדְרָן עֲלָךְ</strong></big><br><br>',
      ],
      ['הָאוֹמֵר לַחֲבֵירוֹ: ״<big><strong>בֵּית כּוֹר</strong></big>״', 'עוד'],
    ];
    expect(walkMarkers(text)).toEqual([
      [true, false, false],
      [true, true],
    ]);
  });

  it('starts a Mishnah at a numbered one', () => {
    const text = [
      [
        'גמרא',
        '<b>ב</b> אָמַר לָהֶם',
        '<big><strong>גמ׳</strong></big>',
        'א <big><strong>אָמַר</strong></big>',
      ],
    ];
    expect(walkMarkers(text)).toEqual([[false, true, false, true]]);
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

describe('processTractate', () => {
  // Build a synthetic 4-amud tractate where perek 2 starts mid-amud.
  // amudIdx 0 (1a) → empty padding (matches Sefaria-Export convention)
  // amudIdx 1 (1b) → empty padding
  // amudIdx 2 (2a) → 5 segs in perek 0
  // amudIdx 3 (2b) → 4 segs total: segs 1-2 still in perek 0, segs 3-4 in perek 1
  // amudIdx 4 (3a) → 3 segs in perek 1
  function fakeDavidson() {
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

  /** English for every segment of `davidson`, each saying where it is. */
  function englishOf(davidson: { text: string[][] }) {
    return { text: davidson.text.map((amud, ai) => amud.map((_, si) => `<b>${ai}</b>:${si}`)) };
  }

  it('gives each segment its English in markers, apart from the Hebrew, and a chapter’s closing line none', () => {
    const davidson = fakeDavidson();
    davidson.text[4][2] = '<big><strong>הדרן עלך כל כתבי</strong></big>';
    const { text, english } = processTractate(
      'Zeraim',
      'Test',
      davidson,
      fakeSchema(),
      englishOf(davidson),
    );
    expect(english.map((amud) => amud.length)).toEqual([5, 4, 3]);
    expect(english[1][0]).toBe('*3*:0');
    expect(english[2][2]).toBe('');
    expect(text).not.toHaveProperty('english');
  });

  const withEnglish = (davidson: { text: string[][] }, english: { text: string[][] }) => () =>
    processTractate('Zeraim', 'Test', davidson, fakeSchema(), english);

  it('allows the English to leave off a closing line that ends an amud', () => {
    const davidson = fakeDavidson();
    davidson.text[3][3] = '<big><strong>הדרן עלך כל כתבי</strong></big>';
    const english = englishOf(davidson);
    english.text[3].pop();
    expect(withEnglish(davidson, english)().english[1][3]).toBe('');
  });

  it('refuses English shaped differently from the Hebrew', () => {
    const davidson = fakeDavidson();
    const missing = englishOf(davidson);
    missing.text[3].pop();
    const extra = englishOf(davidson);
    extra.text[3].push('<b>more</b>');
    const extraAmud = englishOf(davidson);
    extraAmud.text.push(['<b>more</b>']);
    for (const english of [missing, extra, extraAmud]) {
      expect(withEnglish(davidson, english)).toThrow();
    }
  });

  it('keeps mid-amud boundary amud in the previous perek', () => {
    const davidson = fakeDavidson();
    const { structure } = processTractate(
      'Zeraim',
      'Test',
      davidson,
      fakeSchema(),
      englishOf(davidson),
    );
    const amud2b = structure.amudim.find((a) => a.daf === 2 && a.amud === 'b')!;
    expect(amud2b.perekIdx).toBe(0); // boundary amud belongs to prev perek
    expect(amud2b.perekBoundaryAt).toBe(2); // 0-indexed: segs [0..2)=perek 0, [2..)=perek 1
    const amud3a = structure.amudim.find((a) => a.daf === 3 && a.amud === 'a')!;
    expect(amud3a.perekIdx).toBe(1);
    expect(amud3a.perekBoundaryAt).toBeUndefined();
  });

  it('drops the empty amudim before the text starts, and keeps an empty one inside it', () => {
    const davidson = fakeDavidson();
    davidson.text.splice(2, 0, []); // 2a, empty: the text opens on 2b
    davidson.text.splice(4, 0, []); // 3a, empty, inside the text
    const schema = {
      alts: { Chapters: { nodes: [{ heTitle: 'פרק א', wholeRef: 'Test 2b:1-4a:3' }] } },
    };
    const { structure, text } = processTractate(
      'Zeraim',
      'Test',
      davidson,
      schema,
      englishOf(davidson),
    );
    expect(structure.amudim.map((a) => `${a.daf}${a.amud}:${a.segmentCount}`)).toEqual([
      '2b:5',
      '3a:0',
      '3b:4',
      '4a:3',
    ]);
    expect(text.amudim.map((amud) => amud.length)).toEqual([5, 0, 4, 3]);
    expect(structure.perakim[0]).toMatchObject({ startAmudIdx: 0, endAmudIdx: 3 });
  });

  it('removes a marker word only where it is a marker, with the colon after a bare one', () => {
    const davidson = fakeDavidson();
    davidson.text[2] = [
      'מַתְנִי׳ <big><strong>הַכֹּל</strong></big> כְּשֵׁרִים',
      '<strong><big>גְּמָ׳</big></strong> אָמַר רַב: מתני׳ דלא כרבי',
      'גְּמָ׳: מַתְנִיתִין',
      'a4',
      'a5',
    ];
    const { text } = processTractate('Zeraim', 'Test', davidson, fakeSchema(), englishOf(davidson));
    expect(text.amudim[0].slice(0, 3)).toEqual([
      'הַכֹּל כְּשֵׁרִים',
      'אָמַר רַב: מתני׳ דלא כרבי',
      'מַתְנִיתִין',
    ]);
  });

  it('keeps the word הדרן, in a chapter’s closing line and in running text', () => {
    const davidson = fakeDavidson();
    davidson.text[2] = [
      'a1',
      'וְהַדְרָן אָמְרוּ',
      'a3',
      'a4',
      '<br><br><big><strong>הַדְרָן עֲלָךְ כׇּל כִּתְבֵי</strong></big><br><br>',
    ];
    const { text } = processTractate('Zeraim', 'Test', davidson, fakeSchema(), englishOf(davidson));
    expect(text.amudim[0][1]).toBe('וְהַדְרָן אָמְרוּ');
    expect(text.amudim[0][4]).toBe('הַדְרָן עֲלָךְ כׇּל כִּתְבֵי');
  });

  it('gives the popup the text with its points, and search the same without them', () => {
    const davidson = fakeDavidson();
    davidson.text[2][0] = '<big><strong>מַתְנִי׳</strong></big> אָמַר <b>רַבִּי</b> יוֹחָנָן';
    const { text, search } = processTractate(
      'Zeraim',
      'Test',
      davidson,
      fakeSchema(),
      englishOf(davidson),
    );
    expect(search.map((amud) => amud.length)).toEqual([5, 4, 3]);
    expect(text.amudim[0][0]).toBe('אָמַר רַבִּי יוֹחָנָן');
    expect(search[0][0]).toBe('אמר רבי יוחנן');
  });

  it('gives English search the bold of each segment, as the English is laid out', () => {
    const davidson = fakeDavidson();
    const { english, searchEnglish } = processTractate(
      'Zeraim',
      'Test',
      davidson,
      fakeSchema(),
      englishOf(davidson),
    );
    expect(searchEnglish.map((amud) => amud.length)).toEqual(english.map((amud) => amud.length));
    expect(searchEnglish[1][0]).toBe('3');
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
