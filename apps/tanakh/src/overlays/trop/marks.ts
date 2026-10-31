// Trop (cantillation marks): what the marks are, and which verses carry them.
//
// The domain half of the trop feature. The overlay that draws it is in
// ../trop.ts.
//
// The Tanakh is chanted in two systems. Psalms, Proverbs and Job 3:2-42:6, the
// poetic books or Sifrei Emet, have a system of their own; every other verse
// is prose. A mark is one way of chanting, which may be written with
// different signs, named differently in each system, or shared by both. Some
// signs are a different mark in each system.

import { TROP_TABS } from '@torahmap/overlay-catalog';
import type { VerseTexts } from '../../verseTexts.ts';

export type System = (typeof TROP_TABS)[number];

export const SYSTEMS: readonly System[] = TROP_TABS;

const POETIC_BOOKS = new Set(['Psalms', 'Proverbs']);

/** Which system a verse is chanted in. Job's prose frame is 1:1-3:1 and 42:7-17. */
export function systemOf(book: string, chapter: number, verse: number): System {
  if (POETIC_BOOKS.has(book)) return 'poetic';
  if (book !== 'Job') return 'prose';
  const afterFrame = chapter > 3 || (chapter === 3 && verse >= 2);
  const beforeFrame = chapter < 42 || (chapter === 42 && verse <= 6);
  return afterFrame && beforeFrame ? 'poetic' : 'prose';
}

interface Group {
  id: string;
  title: string;
  hebrew: string;
  /** What the group's marks do, as one short line. */
  blurb: string;
}

export interface SystemInfo {
  label: string;
  intro: string;
  /** In the order they are drawn. */
  groups: readonly Group[];
}

export const SYSTEM_INFO: Record<System, SystemInfo> = {
  prose: {
    label: 'Prose',
    intro: 'Ranked as the chant ranks them: each mark divides the verse, or leads into the next.',
    groups: [
      { id: 'emperors', title: 'Emperors', hebrew: 'קיסרים', blurb: 'end the verse and its half' },
      { id: 'kings', title: 'Kings', hebrew: 'מלכים', blurb: 'divide each half' },
      { id: 'dukes', title: 'Dukes', hebrew: 'משנים', blurb: 'divide the parts of each half' },
      { id: 'counts', title: 'Counts', hebrew: 'שלישים', blurb: 'divide the smallest parts' },
      { id: 'servants', title: 'Servants', hebrew: 'משרתים', blurb: 'lead into the next mark' },
    ],
  },
  poetic: {
    label: 'Poetic books',
    intro:
      'The poetic books, the Sifrei Emet, are chanted in a system of their own. Several signs ' +
      'look like prose marks but are not: the tipcha sign is tarcha, a servant.',
    groups: [
      { id: 'dividers', title: 'Dividers', hebrew: 'מפסיקים', blurb: 'divide the verse' },
      { id: 'servants', title: 'Servants', hebrew: 'משרתים', blurb: 'lead into the next mark' },
    ],
  },
};

// The cantillation marks open the Hebrew points-and-accents block, so every
// one is also something the shell's isNikkud strips; the vowel points after
// them are not trop.
const TROP_START = 0x0591;
const TROP_END = 0x05af;

/** Is this one of the cantillation marks, the accents that say how a verse is chanted? */
function isTropMark(code: number): boolean {
  return code >= TROP_START && code <= TROP_END;
}

// The sign of sof pasuq's accent, silluq, is the meteg: the same character
// that stops a word's stress elsewhere, outside the cantillation block.
const METEG = 'ֽ';
const GERESH_MUQDAM = '֝';
const REVIA = '֗';
const OLE = '֫';
const MERKHA = '֥';
// A sign that is half of another mark when its word also carries the other half.
const HALF_OF: ReadonlyArray<readonly [half: string, whole: string]> = [
  [REVIA, GERESH_MUQDAM],
  [MERKHA, OLE],
];

export interface TropMark {
  /** The English name, in prose where the mark has both. */
  name: string;
  hebrewName: string;
  /** What poetry calls the mark, when it is not the same. */
  inPoetry?: {
    name: string;
    hebrewName: string;
    /** False when the two names are close enough that neither chart needs to mention the other. */
    noteInOtherSystem?: boolean;
  };
  /** The signs that write the mark in every system it is used in. */
  signs: readonly string[];
  /** Signs that write the mark in prose only; the poetic books use them for another mark. */
  proseSigns?: readonly string[];
  /** The group the mark belongs to in each system it is used in. */
  groups: Partial<Record<System, string>>;
}

// Listed in the order each group draws them in: any group's marks, in either
// system, keep this relative order.
export const TROP_MARKS: readonly TropMark[] = [
  {
    name: 'Sof Pasuq',
    hebrewName: 'סוף פסוק',
    signs: [METEG],
    groups: { prose: 'emperors', poetic: 'dividers' },
  },
  {
    name: 'Ole ve-Yored',
    hebrewName: 'עולה ויורד',
    signs: [OLE],
    groups: { poetic: 'dividers' },
  },
  {
    name: 'Etnachta',
    hebrewName: 'אתנחתא',
    inPoetry: { name: 'Etnach', hebrewName: 'אתנח', noteInOtherSystem: false },
    signs: ['֑'],
    groups: { prose: 'emperors', poetic: 'dividers' },
  },
  { name: 'Tipcha', hebrewName: 'טפחא', signs: ['֖'], groups: { prose: 'kings' } },
  { name: 'Zaqef Qatan', hebrewName: 'זקף קטן', signs: ['֔'], groups: { prose: 'kings' } },
  { name: 'Zaqef Gadol', hebrewName: 'זקף גדול', signs: ['֕'], groups: { prose: 'kings' } },
  { name: 'Segol', hebrewName: 'סגול', signs: ['֒'], groups: { prose: 'kings' } },
  { name: 'Pashta', hebrewName: 'פשטא', signs: ['֙'], groups: { prose: 'dukes' } },
  {
    name: 'Revia',
    hebrewName: 'רביע',
    signs: [REVIA],
    groups: { prose: 'dukes', poetic: 'dividers' },
  },
  {
    name: 'Revia Mugrash',
    hebrewName: 'רביע מוגרש',
    signs: [GERESH_MUQDAM],
    groups: { poetic: 'dividers' },
  },
  { name: 'Dehi', hebrewName: 'דחי', signs: ['֭'], groups: { poetic: 'dividers' } },
  { name: 'Tevir', hebrewName: 'תביר', signs: ['֛'], groups: { prose: 'dukes' } },
  { name: 'Yetiv', hebrewName: 'יתיב', signs: ['֚'], groups: { prose: 'dukes' } },
  {
    name: 'Zarqa',
    hebrewName: 'זרקא',
    inPoetry: { name: 'Tsinnor', hebrewName: 'צנור' },
    signs: ['֮'],
    proseSigns: ['֘'],
    groups: { prose: 'dukes', poetic: 'dividers' },
  },
  { name: 'Geresh', hebrewName: 'גרש', signs: ['֜'], groups: { prose: 'counts' } },
  {
    name: 'Telisha Gedola',
    hebrewName: 'תלישא גדולה',
    signs: ['֠'],
    groups: { prose: 'counts' },
  },
  { name: 'Gershayim', hebrewName: 'גרשיים', signs: ['֞'], groups: { prose: 'counts' } },
  {
    name: 'Pazer',
    hebrewName: 'פזר',
    signs: ['֡'],
    groups: { prose: 'counts', poetic: 'dividers' },
  },
  { name: 'Karnei Parah', hebrewName: 'קרני פרה', signs: ['֟'], groups: { prose: 'counts' } },
  {
    name: 'Shalshelet',
    hebrewName: 'שלשלת',
    signs: ['֓'],
    groups: { prose: 'kings', poetic: 'dividers' },
  },
  {
    name: 'Munach',
    hebrewName: 'מונח',
    signs: ['֣'],
    groups: { prose: 'servants', poetic: 'servants' },
  },
  {
    name: 'Merkha',
    hebrewName: 'מרכא',
    signs: [MERKHA],
    groups: { prose: 'servants', poetic: 'servants' },
  },
  {
    name: 'Mahapakh',
    hebrewName: 'מהפך',
    signs: ['֤'],
    groups: { prose: 'servants', poetic: 'servants' },
  },
  {
    name: 'Qadma',
    hebrewName: 'קדמא',
    inPoetry: { name: 'Azla', hebrewName: 'אזלא' },
    signs: ['֨'],
    groups: { prose: 'servants', poetic: 'servants' },
  },
  { name: 'Tarcha', hebrewName: 'טרחא', signs: ['֖'], groups: { poetic: 'servants' } },
  {
    name: 'Tsinnorit',
    hebrewName: 'צנורית',
    signs: ['֘'],
    groups: { poetic: 'servants' },
  },
  {
    name: 'Atnah Hafukh',
    hebrewName: 'אתנח הפוך',
    signs: ['֢'],
    groups: { poetic: 'servants' },
  },
  { name: 'Darga', hebrewName: 'דרגא', signs: ['֧'], groups: { prose: 'servants' } },
  {
    name: 'Telisha Qetana',
    hebrewName: 'תלישא קטנה',
    signs: ['֩'],
    groups: { prose: 'servants' },
  },
  { name: 'Iluy', hebrewName: 'עילוי', signs: ['֬'], groups: { poetic: 'servants' } },
  {
    name: 'Yerah Ben Yomo',
    hebrewName: 'ירח בן יומו',
    inPoetry: { name: 'Galgal', hebrewName: 'גלגל' },
    signs: ['֪'],
    groups: { prose: 'servants', poetic: 'servants' },
  },
  {
    name: 'Merkha Kefula',
    hebrewName: 'מרכא כפולה',
    signs: ['֦'],
    groups: { prose: 'servants' },
  },
];

/** A mark's URL slug: its name where it is first used, prose before poetry. */
export function slugOf(mark: TropMark): string {
  return mark.name.toLowerCase().replace(/\s+/g, '-');
}

const MARK_BY_SLUG: ReadonlyMap<string, TropMark> = new Map(
  TROP_MARKS.map((mark) => [slugOf(mark), mark]),
);

export function nameIn(mark: TropMark, system: System): { name: string; hebrewName: string } {
  return system === 'poetic' && mark.inPoetry ? mark.inPoetry : mark;
}

/** Does `system`'s chart offer the mark with this slug? */
export function offers(system: System, slug: string): boolean {
  return Boolean(MARK_BY_SLUG.get(slug)?.groups[system]);
}

/** "Azla in poetry": the mark's name in the other system when it differs, for a reader who knows it by that. */
export function otherName(mark: TropMark, system: System): string | null {
  if (!mark.groups.prose || !mark.groups.poetic) return null;
  if (mark.inPoetry?.noteInOtherSystem === false) return null;
  const [other, where] =
    system === 'prose' ? (['poetic', 'poetry'] as const) : (['prose', 'prose'] as const);
  const there = nameIn(mark, other).name;
  return there === nameIn(mark, system).name ? null : `${there} in ${where}`;
}

/** The marks a system draws, by group, in drawing order. */
export function marksByGroup(system: System): { group: Group; marks: TropMark[] }[] {
  return SYSTEM_INFO[system].groups.map((group) => ({
    group,
    marks: TROP_MARKS.filter((mark) => mark.groups[system] === group.id),
  }));
}

/** The signs that write `mark` in verses of `system`. */
export function signsOf(mark: TropMark, system: System): readonly string[] {
  if (!mark.groups[system]) return [];
  return system === 'prose' ? [...mark.signs, ...(mark.proseSigns ?? [])] : mark.signs;
}

const OWNER: Record<System, Map<string, TropMark>> = { prose: new Map(), poetic: new Map() };
for (const mark of TROP_MARKS) {
  for (const system of SYSTEMS) {
    for (const sign of signsOf(mark, system)) OWNER[system].set(sign, mark);
  }
}

// By occurrences across the Tanakh. The rare marks run to Yerah Ben Yomo at 55
// and the next is Iluy at 184, so any RARE between them leaves the same four rare.
export const RARITY_THRESHOLDS = {
  RARE: 100,
  UNCOMMON: 500,
};

export type RarityTier = 'rare' | 'uncommon' | 'common';

export function getRarityTier(count: number): RarityTier {
  if (count < RARITY_THRESHOLDS.RARE) return 'rare';
  if (count < RARITY_THRESHOLDS.UNCOMMON) return 'uncommon';
  return 'common';
}

interface Occurrence {
  sign: string;
  /** Where the sign is in the text. */
  index: number;
}

// A qere in brackets after the last word does not end the verse's last word.
const TRAILING_QERE = /\s*\([^)]*\)\s*$/;

/**
 * Every sign of a verse's cantillation, in order.
 *
 * Two signs are read in their context: the meteg counts only as the silluq of
 * the last word, which makes it sof pasuq; and a revia with a geresh muqdam, or
 * a merkha with an ole, is half of a revia mugrash or an ole ve-yored.
 */
function occurrences(hebrewText: string): Occurrence[] {
  const found: Occurrence[] = [];
  const end = hebrewText.lastIndexOf('\u05C3');
  const body = (end < 0 ? hebrewText : hebrewText.slice(0, end)).replace(TRAILING_QERE, '');
  const lastWordStart = body.search(/\S+$/);
  let yoredOwed = false;
  for (const word of hebrewText.matchAll(/\S+/g)) {
    const halves = HALF_OF.filter(([, whole]) => word[0].includes(whole)).map(([half]) => half);
    // An ole without a merkha on its word has its yored on the next word.
    if (yoredOwed) halves.push(MERKHA);
    yoredOwed = word[0].includes(OLE) && !word[0].includes(MERKHA);
    let silluq = -1;
    for (let i = 0; i < word[0].length; i++) {
      const sign = word[0][i];
      const index = word.index + i;
      if (sign === METEG) {
        if (word.index === lastWordStart) silluq = index;
      } else if (isTropMark(sign.charCodeAt(0)) && !halves.includes(sign)) {
        found.push({ sign, index });
      }
    }
    if (silluq >= 0) found.push({ sign: METEG, index: silluq });
  }
  return found;
}

/** The text positions of the cantillation signs in `signs`. */
export function signPositions(hebrewText: string, signs: readonly string[]): Set<number> {
  return new Set(
    occurrences(hebrewText)
      .filter(({ sign }) => signs.includes(sign))
      .map(({ index }) => index),
  );
}

interface TropVerseLocation {
  book: string;
  chapter: number;
  verse: number;
  count: number; // How many times the mark appears in this verse
}

export interface TropIndexEntry {
  mark: TropMark;
  totalCount: number;
  verses: TropVerseLocation[];
}

/** Every mark, by URL slug, with the verses that carry it in either system. */
export type TropIndex = Map<string, TropIndexEntry>;

export function buildTropIndex(verseTexts: VerseTexts): TropIndex {
  const index: TropIndex = new Map(
    [...MARK_BY_SLUG].map(([slug, mark]) => [slug, { mark, totalCount: 0, verses: [] }]),
  );

  for (const [book, chapters] of Object.entries(verseTexts)) {
    for (const [chapterStr, verses] of Object.entries(chapters)) {
      const chapter = parseInt(chapterStr, 10);
      for (const [verseStr, text] of Object.entries(verses)) {
        const verse = parseInt(verseStr, 10);
        const owners = OWNER[systemOf(book, chapter, verse)];
        const counts = new Map<TropMark, number>();
        for (const { sign } of occurrences(text.he)) {
          const mark = owners.get(sign);
          if (mark) counts.set(mark, (counts.get(mark) ?? 0) + 1);
        }
        for (const [mark, count] of counts) {
          const entry = index.get(slugOf(mark))!;
          entry.totalCount += count;
          entry.verses.push({ book, chapter, verse, count });
        }
      }
    }
  }

  return index;
}
