// @vitest-environment node
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileFor } from './browser/site.ts';
import { refusedConnection } from './browser/stopOnRefusal.ts';

describe('the site a browser suite serves', () => {
  const built = mkdtempSync(join(tmpdir(), 'site-test-'));
  const shared = mkdtempSync(join(tmpdir(), 'site-test-'));
  mkdirSync(join(built, 'talmud'));
  writeFileSync(join(built, 'talmud', 'index.html'), '');
  writeFileSync(join(shared, 'favicon.png'), '');
  writeFileSync(join(built, 'secret.txt'), '');

  it('serves a folder as its index.html, and falls through to the next root', () => {
    expect(fileFor('/talmud/', [built, shared])).toBe(join(built, 'talmud', 'index.html'));
    expect(fileFor('/favicon.png', [built, shared])).toBe(join(shared, 'favicon.png'));
    expect(fileFor('/missing', [built, shared])).toBeUndefined();
  });

  it('never names a file outside its roots', () => {
    expect(fileFor('/../secret.txt', [shared])).toBeUndefined();
    expect(fileFor('/%2e%2e/secret.txt', [shared])).toBeUndefined();
  });
});

describe('a refused connection', () => {
  it('is told from other failures', () => {
    expect(refusedConnection(['page.goto: net::ERR_CONNECTION_REFUSED at http://x/'])).toBe(true);
    expect(refusedConnection(['expected 1, got 2'])).toBe(false);
  });
});
