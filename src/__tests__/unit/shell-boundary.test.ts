// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IMPORT } from '../helpers/imports.ts';

const ROOT = resolve(__dirname, '../../..');

/** Each text's own code. */
const TANAKH = [
  'src/tanakh/',
  'src/main-tanakh.ts',
  'src/overlays/',
  'src/layout.ts',
  'src/labels.ts',
  'src/mapTitle.ts',
  'src/constants/books.ts',
  'src/verseTexts.ts',
  'packages/link/src/tanakh.ts',
  'packages/overlay-catalog/',
  'packages/site/src/tanakh.ts',
  'packages/stories/src/tanakh.ts',
  'packages/stories/src/generated.ts',
];
const TALMUD = ['src/talmud/', 'src/main-talmud.ts'];

// A stylesheet or picture: `./frame.css`, `./mapTitle.svg?raw`.
const ASSET = /\.(?!ts$)\w+(\?\w*)?$/;

/** The file an import names: a path, or the entry its package's package.json exports. */
function target(file: string, spec: string): string | undefined {
  if (!spec.startsWith('@')) {
    const path = spec.startsWith('/') ? resolve(ROOT, spec.slice(1)) : resolve(dirname(file), spec);
    return [path, `${path}.ts`, `${path}/index.ts`].find(
      (candidate) => candidate.endsWith('.ts') && existsSync(candidate),
    );
  }
  const [, name, entry = ''] = spec.match(/^@torahmap\/([^/]+)(\/.+)?$/)!;
  const pkg = resolve(ROOT, 'packages', name);
  const { exports } = JSON.parse(readFileSync(resolve(pkg, 'package.json'), 'utf8'));
  // An entry of its own, or a package's every file, as `"./*": "./src/*"`.
  const path: string | undefined =
    exports[`.${entry}`] ?? (entry && exports['./*']?.replace('*', entry.slice(1)));
  return path && resolve(pkg, path);
}

/** Every source file a file reaches through its imports, itself included. */
function reached(start: string): Set<string> {
  const seen = new Set([start]);
  const queue = [start];
  for (const file of queue) {
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      if (ASSET.test(spec)) continue;
      const path = target(file, spec);
      if (!path) throw new Error(`${relative(ROOT, file)} imports ${spec}, which is not there`);
      if (seen.has(path)) continue;
      seen.add(path);
      queue.push(path);
    }
  }
  return seen;
}

/** The files `start` reaches that are one of `texts`' own code. */
function reachedIn(start: string, ...texts: string[][]): string[] {
  const files = [...reached(resolve(ROOT, start))].map((file) => relative(ROOT, file));
  expect(files.length).toBeGreaterThan(1);
  return files.filter((file) => texts.flat().some((code) => file.startsWith(code)));
}

describe('the code each page runs', () => {
  it('is listed by paths that exist', () => {
    const lists = [...TANAKH, ...TALMUD];
    expect(lists.filter((path) => !existsSync(resolve(ROOT, path)))).toEqual([]);
  });

  it('in the app shell, is no text’s own', () => {
    expect(reachedIn('packages/shell/src/main.ts', TANAKH, TALMUD)).toEqual([]);
  });

  it('for the Talmud, is none of the Tanakh’s', () => {
    expect(reachedIn('src/main-talmud.ts', TANAKH)).toEqual([]);
  });

  it('for the Tanakh, is none of the Talmud’s', () => {
    expect(reachedIn('src/main-tanakh.ts', TALMUD)).toEqual([]);
  });
});
