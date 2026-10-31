// @vitest-environment node
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { scramble, unpack } from '@torahmap/utils';
import { pack } from '../scripts/ieeevis/pack.ts';

describe('a packed file', () => {
  it('reads back as the JSON it was made from', async () => {
    const texts = { '0.0': 'Title\nA paper — with “quotes” and ünïcode.', '0.1': 'More.' };
    const packed = pack(JSON.stringify(texts));
    const buffer = packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength);
    expect(await unpack(buffer as ArrayBuffer)).toEqual(texts);
  });

  it('is not gzip or JSON until unscrambled', () => {
    const gzip = new Uint8Array(gzipSync('{"a":1}'));
    expect(scramble(gzip)).not.toEqual(gzip);
    expect(scramble(scramble(gzip))).toEqual(gzip);
  });
});
