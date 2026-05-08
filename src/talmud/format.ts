import type { TalmudIdentity } from "../types.ts";
import type { CorpusFormat } from "../format.ts";

export const talmudFormat: CorpusFormat<TalmudIdentity> = {
  format(id) {
    return `${id.tractate} ${id.daf}${id.amud}:${id.segment}`;
  },

  serializeHash(id) {
    return `${id.tractate}:${id.daf}${id.amud}:${id.segment}`;
  },

  parseHash(hash) {
    if (!hash) return null;
    const parts = hash.split(":");
    if (parts.length !== 3) return null;
    const [tractate, dafAmud, segStr] = parts;
    if (!tractate) return null;
    const m = dafAmud.match(/^(\d+)([ab])$/);
    if (!m) return null;
    const daf = parseInt(m[1], 10);
    const segment = parseInt(segStr, 10);
    if (isNaN(daf) || isNaN(segment)) return null;
    return { tractate, daf, amud: m[2] as "a" | "b", segment };
  },
};
