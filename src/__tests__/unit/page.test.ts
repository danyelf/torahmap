// Each text's page is the one index.html, filled from its site.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fillPage } from '../../app/page.ts';
import { tanakhSite } from '../../tanakh/site.ts';
import { talmudSite } from '../../talmud/site.ts';

const TEMPLATE = readFileSync(join(__dirname, '../../../index.html'), 'utf8');

describe.each([
  ['Tanakh', tanakhSite, '/src/main-tanakh.ts'],
  ['Talmud', talmudSite, '/src/main-talmud.ts'],
])("the %s's page", (_, site, entry) => {
  const page = fillPage(TEMPLATE, site, entry);
  // A template's content is inert, so nothing in the page loads.
  const template = document.createElement('template');
  template.innerHTML = page;
  const doc = template.content;

  it('leaves no placeholder unfilled', () => {
    expect(page).not.toMatch(/%[A-Z_]+%/);
  });

  it('is titled with its site’s name, and runs its own text', () => {
    expect(doc.querySelector('title')?.textContent).toBe(site.name);
    expect(doc.querySelector('#no-webgl h1')?.textContent).toBe(site.name);
    expect(doc.querySelector('script[type="module"]')?.getAttribute('src')).toBe(entry);
  });

  it('describes itself in its own words', () => {
    const meta = (name: string) =>
      doc.querySelector(`meta[name="${name}"], meta[property="${name}"]`)?.getAttribute('content');
    expect(meta('description')).toBe(site.page.tagline);
    expect(meta('og:url')).toBe(site.page.url);
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(site.page.url);
    expect(meta('og:image') ?? null).toBe(site.page.image?.url ?? null);
    expect(doc.querySelector('noscript')?.textContent).toContain(site.page.noScript);
    expect(doc.querySelector('#no-webgl')?.textContent).toContain(site.page.noWebGl);
    expect(doc.querySelector('#no-webgl a')?.getAttribute('href')).toBe(site.page.textUrl);
  });
});
