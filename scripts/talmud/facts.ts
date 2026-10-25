// The facts sefaria-dating-facts.py reads out of Sefaria's database dump, which dating.ts turns
// into the map's data file.

/** A generation, as opposed to the other kinds of period Sefaria codes. */
const GENERATION_CODE = /^(?:[ZTA]\d|TA)$/;

export interface Mention {
  ref: string;
  topic: string;
  language: string | null;
  version: string | null;
  start: number | null;
  end: number | null;
  /** The tagged words as the dump's edition spells them. */
  text: string | null;
}

export interface Facts {
  mentions: Mention[];
  /** An ambiguous topic's possible people. */
  candidates: Record<string, string[]>;
  /** `names` is every title Sefaria records for the topic. */
  topics: Record<
    string,
    { en: string | null; he: string | null; generation: string | null; names: string[] }
  >;
  periods: Record<string, { from: number; to: number }>;
}

export const isAmbiguous = (slug: string) => slug.endsWith('(ambiguous)');

/** The latest generation a code names, "A2/A3" being A3; null for a code that is none. */
export function latestGeneration(
  code: string | null | undefined,
  periods: Facts['periods'],
): string | null {
  const parts = (code ?? '').split('/').filter((c) => GENERATION_CODE.test(c) && periods[c]);
  return parts.sort((a, b) => periods[b].from - periods[a].from)[0] ?? null;
}
