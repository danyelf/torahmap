/**
 * Packs the VIS papers' text for serving: public/data/ieeevis/texts.json (from the ieeevis-scrape
 * build) becomes public/data/ieeevis/p.bin, which is what the Worker's bucket holds. Neither file
 * is committed.
 *
 *     npx tsx scripts/ieeevis/pack-texts.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { pack } from './pack.ts';

const dir = new URL('../../public/data/ieeevis/', import.meta.url);
const json = readFileSync(new URL('texts.json', dir));
const packed = pack(json);
writeFileSync(new URL('p.bin', dir), packed);
console.log(`${json.length} bytes of JSON packed into ${packed.length}`);
