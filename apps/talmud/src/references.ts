// Reads a reference to the Talmud, such as "Berakhot 3b:4" or ברכות ג:.

import type { Reference, ReferenceReader } from '@torahmap/shell/app/text.ts';
import {
  nameCompleter,
  nameReader,
  numberIn,
  referenceTokens,
  type Token,
} from '@torahmap/shell/references.ts';
import { talmudId } from './layout.ts';

type Side = 'a' | 'b';

/** References offered under the Go to box, to try. */
export const EXAMPLES = ['Berakhot 17a'];

/** A tractate as the reader needs it: its names and how many segments each amud has. */
export interface ReferencedTractate {
  name: string;
  hebrewName: string;
  amudim: readonly { daf: number; amud: Side; segmentCount: number }[];
}

// The abbreviations readers write tractates as, which are not the start of their names, and
// Ashkenazi spellings with s for t inside the name.
const OTHER_NAMES: Record<string, readonly string[]> = {
  'Bava Kamma': ['BK', 'ב״ק'],
  'Bava Metzia': ['BM', 'ב״מ'],
  'Bava Batra': ['BB', 'ב״ב'],
  'Rosh Hashanah': ['RH', 'ר״ה'],
  'Moed Katan': ['MK', 'מו״ק'],
  'Avodah Zarah': ['AZ', 'ע״ז'],
  Ketubot: ['Kesubos'],
  Keritot: ['Kerisos'],
  Arakhin: ['Erchin'],
};

const FILLER = new Set(['daf', 'amud', 'page', 'דף', 'עמוד']);
const SIDES: Record<string, Side> = { a: 'a', b: 'b', עא: 'a', עב: 'b' };
// Hebrew writes the side as the mark after the daf: ג. is 3a, ג: is 3b.
const MARKED: Record<string, Side> = { '.': 'a', ':': 'b' };
const HEBREW_SIDES: Record<string, Side> = { א: 'a', ב: 'b' };

interface Place {
  daf: number;
  side?: Side;
  segment?: number;
}

/** The place `tokens` give after the tractate's name, or null when they give none. */
function placeIn(tokens: readonly Token[]): Place | null {
  const [first, ...rest] = tokens;
  if (!first) return null;
  const latin = /^\d+$/.test(first.text);
  const daf = numberIn(first);
  if (daf === null) return null;

  let side = latin ? undefined : MARKED[first.mark];
  if (!side && rest[0]) {
    side = SIDES[rest[0].text] ?? (latin ? undefined : HEBREW_SIDES[rest[0].text]);
    if (side) rest.shift();
  }
  if (rest.length === 0) return { daf, side };
  if (!side || rest.length > 1) return null;
  const segment = numberIn(rest[0]);
  return segment === null ? null : { daf, side, segment };
}

/** Reads a reference to one of `tractates`: a tractate, a daf, an amud or a segment. */
export function segmentReader(tractates: readonly ReferencedTractate[]): ReferenceReader {
  const byName = new Map(tractates.map((t) => [t.name, t]));
  const entries = tractates.map((t) => ({
    key: t.name,
    names: [t.name, t.hebrewName, ...(OTHER_NAMES[t.name] ?? [])],
  }));
  const readName = nameReader(entries);

  function read(typed: string): Reference | null {
    const named = readName(referenceTokens(typed));
    if (!named) return null;
    const tractate = byName.get(named.key)!;
    const rest = named.rest.filter((t) => !FILLER.has(t.text));
    const place = rest.length === 0 ? null : placeIn(rest);
    if (rest.length > 0 && !place) return null;

    const ids: string[] = [];
    for (const { daf, amud, segmentCount } of tractate.amudim) {
      if (place && (daf !== place.daf || (place.side && amud !== place.side))) continue;
      for (let segment = 1; segment <= segmentCount; segment++) {
        if (place?.segment !== undefined && segment !== place.segment) continue;
        ids.push(talmudId({ tractate: tractate.name, daf, amud, segment }));
      }
    }
    if (ids.length === 0) return null;

    const page = place ? ` ${place.daf}${place.side ?? ''}` : '';
    const segment = place?.segment !== undefined ? `:${place.segment}` : '';
    return { ref: `${tractate.name}${page}${segment}`, ids };
  }

  return { read, complete: nameCompleter(entries) };
}
