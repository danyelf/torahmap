import { describe, expect, it } from 'vitest';
import { lineKinds } from './lineKind.ts';

describe('lineKinds', () => {
  it('marks blank lines and imports', () => {
    expect(
      lineKinds('a.ts', ['', '  ', "import { x } from './x';", "export { y } from './y';"]),
    ).toBe('bbii');
  });

  it('marks line and block comments but not trailing ones', () => {
    expect(
      lineKinds('a.ts', ['// note', '/**', ' * more', ' */', 'const a = 1; // trailing']),
    ).toBe('ccccx');
  });

  it('marks lines that open a function, method, class or interface', () => {
    expect(
      lineKinds('a.ts', [
        'export function f(x: number): number {',
        'async function g() {',
        'export const h = (a: string) => {',
        '  method(a: string): void {',
        'export class C {',
        'interface I {',
        '  if (x) {',
      ]),
    ).toBe('hhhhhhx');
  });

  it('gives other files only blank and code', () => {
    expect(lineKinds('README.md', ['# Title', '', 'text'])).toBe('xbx');
  });

  it('reads Python', () => {
    expect(lineKinds('a.py', ['import os', '# note', 'def f():', '    return 1'])).toBe('ichx');
  });
});
