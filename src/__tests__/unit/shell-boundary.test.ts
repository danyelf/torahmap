// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../..');

/** The texts' own code: their folders, and the Tanakh's files still outside its folder. */
const TEXT_CODE = [
  'tanakh/',
  'talmud/',
  'overlays/index.ts',
  'overlays/commentary.ts',
  'overlays/haftarah.ts',
  'overlays/haftarah/',
  'overlays/trop.ts',
  'overlays/trop/',
  'overlays/verse-length.ts',
  'layout.ts',
  'labels.ts',
  'constants/books.ts',
  'verseTexts.ts',
];

// `from './x'`, `import './x'` and `import('./x')`.
const IMPORT = /(?:\bfrom|\bimport)\s*\(?\s*'(\.[^']+)'/g;
// A stylesheet or picture: `./frame.css`, `./mapTitle.svg?raw`.
const ASSET = /\.(?!ts$)\w+(\?\w*)?$/;

/** Every source file a file reaches through its imports, itself included. */
function reached(start: string): Set<string> {
  const seen = new Set([start]);
  const queue = [start];
  for (const file of queue) {
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      if (ASSET.test(spec)) continue;
      const target = resolve(dirname(file), spec);
      const path = [target, `${target}.ts`, `${target}/index.ts`].find(
        (file) => file.endsWith('.ts') && existsSync(file),
      );
      if (!path) throw new Error(`${relative(SRC, file)} imports ${spec}, which is not there`);
      if (seen.has(path)) continue;
      seen.add(path);
      queue.push(path);
    }
  }
  return seen;
}

describe('the app shell', () => {
  it('reaches no text’s own code', () => {
    const files = [...reached(resolve(SRC, 'main.ts'))].map((file) => relative(SRC, file));
    expect(files.length).toBeGreaterThan(1);
    expect(files.filter((file) => TEXT_CODE.some((code) => file.startsWith(code)))).toEqual([]);
  });
});
