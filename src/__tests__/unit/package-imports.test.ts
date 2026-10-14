// @vitest-environment node
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IMPORT } from '../helpers/imports.ts';

const PACKAGES = resolve(__dirname, '../../../packages');
const CODE = /\.[cm]?[jt]sx?$/;
// The paths that `import.meta.glob('./x/*.md')` and `new URL('./x', import.meta.url)` name.
const PATH_ARGUMENT = /(?:\bimport\.meta\.glob|\bnew URL)\(\s*['"`]([^'"`]+)['"`]/g;

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
  return codeFiles(pkg).flatMap((file) => {
    const code = readFileSync(file, 'utf8');
    const specs = [...code.matchAll(IMPORT), ...code.matchAll(PATH_ARGUMENT)].map(
      ([, spec]) => spec,
    );
    return specs.flatMap((spec) => {
      const where = `${relative(pkg, file)} imports ${spec}`;
      if (spec.startsWith('/')) return [`${where}, from the project root`];
      if (spec.startsWith('.')) {
        return relative(pkg, resolve(dirname(file), spec)).startsWith('..')
          ? [`${where}, outside its package`]
          : [];
      }
      const named = spec.match(/^@torahmap\/[^/]+/)?.[0];
      if (!named) return [];
      return named === name || named in dependencies ? [] : [`${where}, not in its package.json`];
    });
  });
}

describe("a package's imports", () => {
  const packages = readdirSync(PACKAGES).filter((name) =>
    existsSync(join(PACKAGES, name, 'package.json')),
  );

  it.each(packages)('%s keeps to itself and what it lists', (name) => {
    expect(importProblems(join(PACKAGES, name))).toEqual([]);
  });

  it('are caught leaving the package or naming an unlisted one', () => {
    const pkg = mkdtempSync(join(tmpdir(), 'package-imports-'));
    try {
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
          "import { f } from 'vitest';",
          "import { g } from '/src/g.ts';",
          'const h = import(`../../h.ts`);',
          "const i = import.meta.glob('../../markdown/*.md');",
          "const j = new URL('../../j.json', import.meta.url);",
        ].join('\n'),
      );
      writeFileSync(join(pkg, 'src/k.tsx'), "import { k } from '../../k.ts';");
      expect(importProblems(pkg).sort()).toEqual(
        [
          'src/index.ts imports ../../src/b.ts, outside its package',
          'src/index.ts imports @torahmap/site/tanakh, not in its package.json',
          'src/index.ts imports /src/g.ts, from the project root',
          'src/index.ts imports ../../h.ts, outside its package',
          'src/index.ts imports ../../markdown/*.md, outside its package',
          'src/index.ts imports ../../j.json, outside its package',
          'src/k.tsx imports ../../k.ts, outside its package',
        ].sort(),
      );
    } finally {
      rmSync(pkg, { recursive: true });
    }
  });
});
