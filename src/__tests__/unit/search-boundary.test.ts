// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../..');
const TANAKH = join(SRC, 'tanakh');
const TANAKH_SEARCH = join(TANAKH, 'search');

/** Source files outside the Tanakh and the tests. */
function shellFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return path === TANAKH || entry.name === '__tests__' ? [] : shellFiles(path);
    }
    return /\.ts$/.test(entry.name) && entry.name !== 'main-tanakh.ts' ? [path] : [];
  });
}

describe("the Tanakh's search", () => {
  it('is imported only by the Tanakh', () => {
    const importers = shellFiles(SRC).filter((file) =>
      [...readFileSync(file, 'utf8').matchAll(/from\s+'(\.[^']+)'/g)].some(([, spec]) =>
        resolve(dirname(file), spec).startsWith(TANAKH_SEARCH),
      ),
    );
    expect(importers.map((file) => relative(SRC, file))).toEqual([]);
  });
});
