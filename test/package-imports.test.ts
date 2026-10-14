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
import { IMPORT } from './helpers/imports.ts';

const ROOT = resolve(__dirname, '..');
// The Tanakh's own code: a package's /tanakh entry, the catalog of its overlays, and its app.
const TANAKH = /^@torahmap\/([^/]+\/tanakh(\.ts)?|overlay-catalog|tanakh)(\/|$)/;
// The Tanakh's app, and the Worker that serves its site, may import it.
const TANAKH_USERS = new Set(['@torahmap/tanakh', '@torahmap/worker']);
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

/**
 * Each import in a package that leaves its folder, names a package its package.json does not list,
 * or names the Tanakh's code from outside it. A package's tests and its own `src/tanakh.ts` may;
 * an app's may not.
 */
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
      if (named !== name && !(named in dependencies)) return [`${where}, not in its package.json`];
      const own = relative(pkg, file);
      const mayUseTanakh =
        TANAKH_USERS.has(name) ||
        own.startsWith('test/') ||
        (own === 'src/tanakh.ts' && !relative(ROOT, pkg).startsWith('apps/'));
      return TANAKH.test(spec) && !mayUseTanakh ? [`${where}, the Tanakh's own code`] : [];
    });
  });
}

describe("a package's imports", () => {
  const packages = ['packages', 'apps'].flatMap((dir) =>
    readdirSync(join(ROOT, dir))
      .map((name) => `${dir}/${name}`)
      .filter((path) => existsSync(join(ROOT, path, 'package.json'))),
  );

  it.each(packages)('%s keeps to itself and what it lists', (path) => {
    expect(importProblems(join(ROOT, path))).toEqual([]);
  });

  it('are caught leaving the package, naming an unlisted one, or reaching the Tanakh', () => {
    const pkg = mkdtempSync(join(tmpdir(), 'package-imports-'));
    try {
      mkdirSync(join(pkg, 'src'));
      writeFileSync(
        join(pkg, 'package.json'),
        JSON.stringify({
          name: '@torahmap/planted',
          dependencies: { '@torahmap/link': '*', '@torahmap/stories': '*' },
        }),
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
          "import { l } from '@torahmap/stories/tanakh';",
        ].join('\n'),
      );
      writeFileSync(join(pkg, 'src/k.tsx'), "import { k } from '../../k.ts';");
      writeFileSync(join(pkg, 'src/tanakh.ts'), "import { m } from '@torahmap/link/tanakh';");
      mkdirSync(join(pkg, 'test'));
      writeFileSync(join(pkg, 'test/n.test.ts'), "import { n } from '@torahmap/stories/tanakh';");
      expect(importProblems(pkg).sort()).toEqual(
        [
          'src/index.ts imports ../../src/b.ts, outside its package',
          'src/index.ts imports @torahmap/site/tanakh, not in its package.json',
          'src/index.ts imports /src/g.ts, from the project root',
          'src/index.ts imports ../../h.ts, outside its package',
          'src/index.ts imports ../../markdown/*.md, outside its package',
          'src/index.ts imports ../../j.json, outside its package',
          'src/k.tsx imports ../../k.ts, outside its package',
          "src/index.ts imports @torahmap/stories/tanakh, the Tanakh's own code",
        ].sort(),
      );
    } finally {
      rmSync(pkg, { recursive: true });
    }
  });
});

// A stylesheet or picture: `./frame.css`, `./mapTitle.svg?raw`.
const ASSET = /\.(?!ts$)\w+(\?\w*)?$/;

/** The file an import names: a path, or what its package's package.json exports for it. */
function target(file: string, spec: string): string | undefined {
  if (!spec.startsWith('@')) {
    const path = spec.startsWith('/') ? resolve(ROOT, spec.slice(1)) : resolve(dirname(file), spec);
    return [path, `${path}.ts`, `${path}/index.ts`].find(
      (candidate) => candidate.endsWith('.ts') && existsSync(candidate),
    );
  }
  const [, name, entry = ''] = spec.match(/^@torahmap\/([^/]+)(\/.+)?$/)!;
  const pkg = ['packages', 'apps'].map((dir) => join(ROOT, dir, name)).find(existsSync)!;
  const { exports } = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8'));
  // An entry of its own, or a package's every file, as `"./*": "./src/*"`.
  const path: string | undefined =
    exports[`.${entry}`] ?? (entry && exports['./*']?.replace('*', entry.slice(1)));
  return path && resolve(pkg, path);
}

/** Every source file a page's entry reaches through its imports, by path from the root. */
function reached(entry: string): string[] {
  const start = join(ROOT, entry);
  const seen = new Set([start]);
  for (const file of seen) {
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      if (ASSET.test(spec)) continue;
      const path = target(file, spec);
      if (!path) throw new Error(`${relative(ROOT, file)} imports ${spec}, which is not there`);
      seen.add(path);
    }
  }
  return [...seen].map((file) => relative(ROOT, file));
}

const TANAKH_CODE = (file: string) =>
  file.startsWith('apps/tanakh/') ||
  file.startsWith('packages/overlay-catalog/') ||
  /^packages\/[^/]+\/src\/(tanakh|generated)\.ts$/.test(file);
const TALMUD_CODE = (file: string) => file.startsWith('apps/talmud/');

// Following each import, as a page loads them: a package can reach a text through its own files.
describe('the code each page runs', () => {
  it('in the app shell, is no text’s own', () => {
    const files = reached('packages/shell/src/main.ts');
    expect(files.length).toBeGreaterThan(1);
    expect(files.filter((file) => TANAKH_CODE(file) || TALMUD_CODE(file))).toEqual([]);
  });

  it('for the Talmud, is none of the Tanakh’s', () => {
    expect(reached('apps/talmud/src/main.ts').filter(TANAKH_CODE)).toEqual([]);
  });

  it('for the Tanakh, is none of the Talmud’s', () => {
    expect(reached('apps/tanakh/src/main.ts').filter(TALMUD_CODE)).toEqual([]);
  });
});
