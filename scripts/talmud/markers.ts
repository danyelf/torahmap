// What tells a tractate's Mishnah from its Gemara in the William Davidson edition: a Mishnah opens
// on מתני׳ or on bold words, the Gemara on גמ׳.

import { stripNikkud } from '@torahmap/hebrew';

export type Marker = 'M' | 'G' | null;

// The geresh after a marker word is sometimes an ASCII apostrophe.
const GERESH = `['׳]`;
// Any points between the letters of a word.
const POINTS = '[\\u0591-\\u05C7]*';
const pointed = (word: string) => [...word].join(POINTS) + POINTS;

// A marker word opens a segment, after any brackets or tags: "<big><strong>מַתְנִי׳</strong></big>",
// "מַתְנִי׳ <strong><big>הַכֹּל</big></strong>", or a bare "גְּמָ׳:" (Arakhin 10a:5). The same
// words occur in running text, so elsewhere they are not markers.
const MARKER_RE = new RegExp(
  `^((?:[\\s\\[\\(]|<[^>]+>)*)(${pointed('מתני')}|${pointed('גמ')})${GERESH}`,
);
// Most chapters open their first Mishnah on bold words without מתני׳: "<big><strong>מֵאֵימָתַי
// </strong></big>" (Berakhot 2a:1), "״<big><strong>קוֹנָם יַיִן</strong></big>" (Nedarim 60a:4).
const BOLD_OPENING_RE = /^[\s״"]*<(?:big|strong)><(?:big|strong)>/;
// Tamid's last chapters have no Gemara and number their mishnayot: "<b>ב</b> אָמַר", "א <big>".
const NUMBERED_RE = /^\s*(?:<b>[א-י]<\/b>|[א-י] <big>)/;

const HADRAN = /^\s*(?:<[^>]+>\s*)*הדרן/;

/** Whether a segment is a chapter's closing line, הדרן עלך, which has no English. */
export const isHadran = (seg: string): boolean => HADRAN.test(stripNikkud(seg));

// Maqaf, paseq, sof pasuq and nun hafukha: stripNikkud keeps them, as word
// separators, but marker matching ignores them.
const HEBREW_SEPARATORS = /[־׀׃׆]/g;

/** Hebrew without points, accents or its four separator marks. */
export function stripNikkudAndSeparators(s: string): string {
  return stripNikkud(s).replace(HEBREW_SEPARATORS, '');
}

/** The part each segment opens, reading the tractate in order. */
export function markersOf(text: string[][]): Marker[][] {
  let afterHadran = false;
  return text.map((amud) =>
    amud.map((seg) => {
      const s = stripNikkudAndSeparators(seg);
      const hadran = HADRAN.test(s);
      const marker = hadran ? null : markerOf(s, afterHadran);
      afterHadran = hadran;
      return marker;
    }),
  );
}

/** The part a segment opens, if any, from its text without points. */
function markerOf(s: string, afterHadran: boolean): Marker {
  const word = s.match(MARKER_RE)?.[2];
  if (word) return word === 'מתני' ? 'M' : 'G';
  // A Mishnah opens every chapter, at times on bold words further in (Bava Batra 102b:9).
  return BOLD_OPENING_RE.test(s) || NUMBERED_RE.test(s) || afterHadran ? 'M' : null;
}

/** Whether each segment is Mishnah. A tractate starts in Gemara; each marker sets the state until the next. */
export function mishnahFrom(markers: Marker[][]): boolean[][] {
  let isMishnah = false;
  return markers.map((amud) =>
    amud.map((m) => {
      if (m) isMishnah = m === 'M';
      return isMishnah;
    }),
  );
}

const MARKER_WORD_RE = new RegExp(`${MARKER_RE.source}(?:\\s*[:,])?`);

/** A segment without the marker word that opens it, and the colon or comma after a bare one. */
export function stripMarkerWord(seg: string, marker: Marker): string {
  return marker ? seg.replace(MARKER_WORD_RE, '$1') : seg;
}
