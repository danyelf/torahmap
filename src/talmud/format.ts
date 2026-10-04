import { bookToUrl } from '@torahmap/link';
import type { TalmudIdentity } from '../types.ts';

/** A segment's id: Bava Kamma 2a:1 is "Bava.Kamma.2a.1". */
export function talmudId(s: TalmudIdentity): string {
  return `${bookToUrl(s.tractate)}.${s.daf}${s.amud}.${s.segment}`;
}
