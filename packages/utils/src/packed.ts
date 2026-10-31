// A file that is gzipped JSON with its bytes scrambled by a short repeating key: not a readable
// .json at a glance, and no protection from anyone who looks. scripts/ieeevis/pack-texts.ts
// writes one; the page reads it here.

const KEY = new TextEncoder().encode('torahmap');

/** The bytes with each XORed against the key; applying it twice returns them. */
export function scramble(bytes: Uint8Array): Uint8Array {
  return bytes.map((byte, i) => byte ^ KEY[i % KEY.length]);
}

/** The JSON a packed file holds. */
export async function unpack(packed: ArrayBuffer): Promise<unknown> {
  const gzipped = scramble(new Uint8Array(packed));
  const stream = new Blob([gzipped as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}
