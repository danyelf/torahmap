// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../..');

/** Each text's own code: its folder and page, and for the Tanakh its overlays and layout. */
const TANAKH = [
  'tanakh/',
  'main-tanakh.ts',
  'overlays/',
  'layout.ts',
  'labels.ts',
  'mapTitle.ts',
  'constants/books.ts',
  'verseTexts.ts',
];
const TALMUD = ['talmud/', 'main-talmud.ts'];
/** What any text's overlays are built on. */
const OVERLAY_BASE = ['overlays/types.ts', 'overlays/settings.ts', 'overlays/prebuild.ts'];

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

/** The files `start` reaches that are one of `texts`' own code. */
function reachedIn(start: string, ...texts: string[][]): string[] {
  const files = [...reached(resolve(SRC, start))].map((file) => relative(SRC, file));
  expect(files.length).toBeGreaterThan(1);
  return files.filter(
    (file) => !OVERLAY_BASE.includes(file) && texts.flat().some((code) => file.startsWith(code)),
  );
}

describe('the code each page runs', () => {
  it('in the app shell, is no text’s own', () => {
    expect(reachedIn('main.ts', TANAKH, TALMUD)).toEqual([]);
  });

  it('for the Talmud, is none of the Tanakh’s', () => {
    expect(reachedIn('main-talmud.ts', TANAKH)).toEqual([]);
  });

  it('for the Tanakh, is none of the Talmud’s', () => {
    expect(reachedIn('main-tanakh.ts', TALMUD)).toEqual([]);
  });
});
