// Each text's page is the one index.html, filled from its own copy.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAP_BACKGROUND } from '@torahmap/engine';
import { colorToCss } from '@torahmap/utils';
import { fillPage } from '../packages/shell/src/app/page.ts';
import { PAGES, pageAt } from '../pages.ts';
import { tanakhText } from '@torahmap/tanakh/text.ts';
import { talmudText } from '@torahmap/talmud/text.ts';
import { euaiactText } from '@torahmap/euaiact/text.ts';

const TEMPLATE = readFileSync(join(__dirname, '../index.html'), 'utf8');

describe('pageAt', () => {
  const [tanakh, talmud, euaiact] = PAGES;

  it('gives each address its own text’s page, query or not', () => {
    for (const path of ['/', '/index.html', '/?verse=Genesis.1.1'])
      expect(pageAt(path)).toBe(tanakh);
    for (const path of ['/talmud/', '/talmud/index.html', '/talmud/?at=Berakhot.2a.1'])
      expect(pageAt(path)).toBe(talmud);
    for (const path of ['/euaiact/', '/euaiact/index.html', '/euaiact/?at=6(2)'])
      expect(pageAt(path)).toBe(euaiact);
  });

  it('gives each text the copy its site shows', () => {
    expect(tanakh.copy).toBe(tanakhText.site.page);
    expect(talmud.copy).toBe(talmudText.site.page);
    expect(euaiact.copy).toBe(euaiactText.site.page);
  });
});

describe.each(PAGES)('the page at $path', ({ copy, entry }) => {
  const page = fillPage(TEMPLATE, copy, entry);
  // A template's content is inert, so nothing in the page loads.
  const template = document.createElement('template');
  template.innerHTML = page;
  const doc = template.content;
  const meta = (name: string) =>
    doc.querySelector(`meta[name="${name}"], meta[property="${name}"]`)?.getAttribute('content');

  it('leaves no placeholder unfilled', () => {
    expect(page).not.toMatch(/%[A-Z_]+%/);
  });

  it('has the map’s background behind it', () => {
    expect(page).toContain(
      `<body data-mode="story" style="background: ${colorToCss(MAP_BACKGROUND)}">`,
    );
  });

  it('is titled with its site’s name, and runs its own text', () => {
    expect(doc.querySelector('title')?.textContent).toBe(copy.name);
    expect(doc.querySelector('#no-webgl h1')?.textContent).toBe(copy.name);
    expect(doc.querySelector('script[type="module"]')?.getAttribute('src')).toBe(entry);
  });

  it('describes itself in its own words', () => {
    expect(meta('description')).toBe(copy.tagline);
    expect(meta('og:url')).toBe(copy.url);
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(copy.url);
    expect(doc.querySelector('noscript')?.textContent).toContain(copy.noScript);
    expect(doc.querySelector('#no-webgl')?.textContent).toContain(copy.noWebGl);
    expect(doc.querySelector('#no-webgl a')?.getAttribute('href')).toBe(copy.textUrl);
  });

  it('names where its text is read, in the popup’s link and the fallback’s', () => {
    expect(doc.querySelector('#no-webgl a')?.textContent).toBe(copy.textSource);
    expect(doc.querySelector('#popup .sefaria-link')?.textContent?.trim()).toBe(
      `View on ${copy.textSource}`,
    );
  });

  it('shows its own icon in the tab, or else the Torahmap’s', () => {
    expect(doc.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe(
      copy.icon ?? '/favicon.png',
    );
  });

  it('promises a large preview only with a picture to show', () => {
    expect(meta('og:image') ?? null).toBe(copy.image?.url ?? null);
    expect(meta('twitter:card')).toBe(copy.image ? 'summary_large_image' : 'summary');
  });
});
