import type { TalmudIdentity } from '../types.ts';

/** A segment's id, which is its link form: Bava Kamma 2a:1 is "Bava.Kamma.2a.1". */
export function talmudId(s: TalmudIdentity): string {
  return `${s.tractate.replace(/ /g, '.')}.${s.daf}${s.amud}.${s.segment}`;
}
