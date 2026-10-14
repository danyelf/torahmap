// @vitest-environment node
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IMPORT } from '../helpers/imports.ts';

const PACKAGES = resolve(__dirname, '../../../packages');
const CODE = /\.(ts|mjs|js)$/;

function codeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : codeFiles(path);
    return CODE.test(entry.name) ? [path] : [];
  });
}

/** Each import in a package that leaves its folder, or names a package its package.json does not list. */
function importProblems(pkg: string): string[] {
  const { name, dependencies = {} } = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8'));
  return codeFiles(pkg).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(IMPORT)].flatMap(([, spec]) => {
      const where = `${relative(pkg, file)} imports ${spec}`;
      if (spec.startsWith('.')) {
        return relative(pkg, resolve(dirname(file), spec)).startsWith('..')
          ? [`${where}, outside its package`]
          : [];
      }
      const named = spec.match(/^@torahmap\/[^/]+/)![0];
      return named === name || named in dependencies ? [] : [`${where}, not in its package.json`];
    }),
  );
}

describe("a package's imports", () => {
  it.each(readdirSync(PACKAGES))('%s keeps to itself and what it lists', (name) => {
    expect(importProblems(join(PACKAGES, name))).toEqual([]);
  });

  it('are caught leaving the package or naming an unlisted one', () => {
    const pkg = mkdtempSync(join(tmpdir(), 'package-imports-'));
    mkdirSync(join(pkg, 'src'));
    writeFileSync(
      join(pkg, 'package.json'),
      JSON.stringify({ name: '@torahmap/planted', dependencies: { '@torahmap/link': '*' } }),
    );
    writeFileSync(
      join(pkg, 'src/index.ts'),
      [
        "import { a } from './a.ts';",
        "import { b } from '../../src/b.ts';",
        "import { c } from '@torahmap/link';",
        "import { d } from '@torahmap/site/tanakh';",
        "import { e } from '@torahmap/planted';",
      ].join('\n'),
    );
    expect(importProblems(pkg)).toEqual([
      'src/index.ts imports ../../src/b.ts, outside its package',
      'src/index.ts imports @torahmap/site/tanakh, not in its package.json',
    ]);
  });
});
