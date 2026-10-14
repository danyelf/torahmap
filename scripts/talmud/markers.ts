// The bold words that tell a tractate's Mishnah from its Gemara: מתני׳ (a Mishnah begins) and גמ׳
// (the Gemara begins).

import { stripNikkud } from '@torahmap/shell/hebrew.ts';

export type Marker = 'M' | 'G' | null;

/** What a segment's own words mark: the part it opens, and whether it ends on a גמ׳. */
export interface SegmentMarkers {
  opens: Marker;
  endsWithGemara: boolean;
}

// The geresh after a marker word is sometimes an ASCII apostrophe, and at Shabbat 82a:13 missing.
const MARKER_WORD = '(מתני|גמ)';
const GERESH = `['׳]`;

// A marker is a marker word in bold at the start of a segment. The same words occur in running
// text ("מתני׳ מני ר״ש היא", Sanhedrin 67a:8), so without the bold they are not markers.
// The forms that occur:
//   "<big><strong>מתני׳</strong></big> ..."     (also <b>, or <strong><big>)
//   "[<big><strong>גמ׳</strong></big> ת״ר] ..." (Sotah 49a:17)
//   "<big><strong>(גמ׳)</strong></big> ..."     (Sotah 49b:4)
//   "מתני׳ <big><strong>הכל</strong></big> ..." (bare word, bold first word)
const WRAPPED_MARKER_RE = new RegExp(
  `^[\\s\\[\\(]*(?:<[^>]+>[\\s\\[\\(]*)*<big[^>]*>(?:[\\s\\(]*<(?:strong|b)\\b[^>]*>)?[\\s\\(]*${MARKER_WORD}${GERESH}`,
);
const BARE_LEADING_MARKER_RE = new RegExp(`^[\\s\\[\\(]*${MARKER_WORD}${GERESH}(?:\\s|$)`);
// Tamid's last three chapters have no Gemara; Wikisource numbers their
// mishnayot with a bold letter instead ("<big><strong>ב</strong></big> אמר").
const NUMBERED_MISHNAH_RE = /^\s*(?:<[^>]+>\s*)*<big[^>]*>\s*<(?:strong|b)\b[^>]*>\s*[א-י](?:\s|<)/;
// Where an amud break falls between a Mishnah and its Gemara, Wikisource
// leaves the גמ׳ at the end of the Mishnah's last segment (Pesachim 71b:14,
// Niddah 56b:25); the Davidson edition puts it on the next segment.
const TRAILING_GEMARA_RE = new RegExp(
  `<big[^>]*>\\s*(?:<(?:strong|b)\\b[^>]*>\\s*)?גמ${GERESH}\\s*(?:<\\/[^>]+>\\s*)*$`,
);
const LEADING_WORD_RE = new RegExp(
  `^((?:[\\s\\[\\(]|<[^>]+>)*)${MARKER_WORD}${GERESH}?(?=[\\s<\\]\\)]|$)`,
);
const TRAILING_WORD_RE = new RegExp(`גמ${GERESH}((?:\\s|<\\/[^>]+>)*)$`);

// Maqaf, paseq, sof pasuq and nun hafukha: stripNikkud keeps them, as word
// separators, but marker matching ignores them.
const HEBREW_SEPARATORS = /[־׀׃׆]/g;

/**
 * Hebrew without points, accents or its four separator marks. The Davidson
 * edition is fully pointed, marker words included (מַתְנִי׳); Wikisource is not.
 */
export function stripNikkudAndSeparators(s: string): string {
  return stripNikkud(s).replace(HEBREW_SEPARATORS, '');
}

export function detectMarker(seg: string): Marker {
  const s = stripNikkudAndSeparators(seg);
  const word =
    s.match(WRAPPED_MARKER_RE)?.[1] ??
    (/<big[^>]*>/.test(s.slice(0, 80)) ? s.match(BARE_LEADING_MARKER_RE)?.[1] : undefined);
  if (word) return word === 'מתני' ? 'M' : 'G';
  if (NUMBERED_MISHNAH_RE.test(s)) return 'M';
  return null;
}

/**
 * Each segment's markers, read from both editions.
 *
 * `other` is a second edition of the same text, segment for segment. Each
 * edition misses markers the other has: the Davidson edition drops the
 * bare מתני׳ that opens most chapters, and Wikisource lacks some גמ׳ at the
 * top of an amud (Avodah Zarah 22b:1), so a segment is a marker if either
 * edition marks it. The two never disagree on which marker it is.
 */
export function markersOf(text: string[][], other: string[][] = []): SegmentMarkers[][] {
  return text.map((amud, ai) =>
    amud.map((seg, si) => {
      const otherSeg = other[ai]?.[si] ?? '';
      return {
        opens: detectMarker(seg) ?? detectMarker(otherSeg),
        endsWithGemara: [seg, otherSeg].some((s) =>
          TRAILING_GEMARA_RE.test(stripNikkudAndSeparators(s)),
        ),
      };
    }),
  );
}

/** Whether each segment is Mishnah. A tractate starts in Gemara; each marker sets the state until the next. */
export function mishnahFrom(markers: SegmentMarkers[][]): boolean[][] {
  let gemaraNext = false;
  let isMishnah = false;
  return markers.map((amud) =>
    amud.map(({ opens, endsWithGemara }) => {
      const m = opens ?? (gemaraNext ? 'G' : null);
      if (m) isMishnah = m === 'M';
      gemaraNext = endsWithGemara;
      return isMishnah;
    }),
  );
}

export function walkMarkers(text: string[][], other: string[][] = []): boolean[][] {
  return mishnahFrom(markersOf(text, other));
}

/** A segment without the marker word that opens or closes it. */
export function stripMarkerWords(seg: string, markers: SegmentMarkers): string {
  if (markers.endsWithGemara) seg = seg.replace(TRAILING_WORD_RE, '$1');
  if (markers.opens) seg = seg.replace(LEADING_WORD_RE, '$1');
  return seg;
}
