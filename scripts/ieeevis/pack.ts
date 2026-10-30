import { gzipSync } from 'node:zlib';
import { scramble } from '../../packages/utils/src/packed.ts';

/** The papers' texts JSON as the page reads it (packages/utils/src/packed.ts). */
export const pack = (json: string | Uint8Array): Uint8Array =>
  scramble(gzipSync(json, { level: 9 }));
