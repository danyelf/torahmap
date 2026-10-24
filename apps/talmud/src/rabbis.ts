// The shape of public/data/talmud/rabbis.json: the rabbis a reader can pick, and who each name in
// dating.json can be. Which passages name a rabbi is read from dating.json.

import { TALMUD_DATA_DIR } from './data.ts';

export const RABBIS_FILE = `${TALMUD_DATA_DIR}/rabbis.json`;

/** A person Sefaria gives a generation. `id` is his Sefaria slug; `gen` is a generation's code. */
export interface Rabbi {
  id: string;
  en: string;
  he: string;
  gen: string;
  /** Every name Sefaria records for him, and those of the shared names that can mean him. */
  names: string[];
}

/** Who a name can be: whether it is certain, then the places in `rabbis` of those it can mean. */
export type Reading = [sure: 0 | 1, ...rabbis: number[]];

export interface TalmudRabbis {
  /** By id. */
  rabbis: Rabbi[];
  /** By place in dating.json's `people`. */
  readings: Reading[];
}
