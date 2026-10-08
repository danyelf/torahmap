// @vitest-environment node
// Chat apps build a link's preview from the page's <title>, description and
// og: tags, so the Worker rewrites them for each link (rewritePage). It edits
// index.html as text, because HTMLRewriter exists only in Cloudflare's
// runtime, not in Node, where these tests run. The Worker serves Vite's
// built dist/index.html, whose build only fills placeholders inside these
// tags (fillPage) and leaves the tags' shape as the source writes them — so
// the test runs on the real source file, and a reformat that breaks the
// match fails here instead of every shared link previewing as the home page.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fillPage } from '../../../app/page.ts';
import { tanakhSite } from '../../../tanakh/site.ts';
import { rewritePage } from '../../../worker/page.ts';

const INDEX = fillPage(
  readFileSync(new URL('../../../../index.html', import.meta.url), 'utf8'),
  tanakhSite,
  '/src/main-tanakh.ts',
);
const tags = {
  title: 'Genesis 12:1 · Torahmap',
  description: 'Commentary overlay. A Visual Concordance of the Hebrew Bible.',
  url: 'https://torahmap.org/?verse=Genesis.12.1&overlay=commentary',
};

const content = (html: string, attr: string, name: string) =>
  new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]*)"`).exec(html)?.[1];

describe('rewritePage, on the real index.html', () => {
  const page = rewritePage(INDEX, tags);

  it('starts from a page with every placeholder filled', () => {
    expect(INDEX).not.toMatch(/%[A-Z_]+%/);
  });

  it('titles the page', () => {
    expect(page).toContain('<title>Genesis 12:1 · Torahmap</title>');
  });

  it('writes every tag a preview reads', () => {
    expect(content(page, 'name', 'description')).toBe(tags.description);
    expect(content(page, 'property', 'og:title')).toBe(tags.title);
    expect(content(page, 'property', 'og:description')).toBe(tags.description);
    expect(content(page, 'property', 'og:url')).toBe(tags.url.replace(/&/g, '&amp;'));
  });

  it('keeps canonical on the home page', () => {
    expect(page).toContain('<link rel="canonical" href="https://torahmap.org/" />');
  });

  it('changes nothing else', () => {
    const strip = (html: string) =>
      html
        .replace(/<title>[\s\S]*?<\/title>/, '')
        .replace(
          /<meta\s+(?:name="description"|property="og:(?:title|description|url)")[\s\S]*?\/>/g,
          '',
        );
    expect(strip(page)).toBe(strip(INDEX));
  });
});

describe('rewritePage, on any layout of those tags', () => {
  it('finds a tag wrapped across lines, as Prettier writes a long one', () => {
    const html = '<title>x</title><meta\n  property="og:title"\n  content="x"\n/>';
    expect(rewritePage(html, { ...tags, description: 'd', url: 'u' })).toContain(
      'content="Genesis 12:1 · Torahmap"',
    );
  });

  it('escapes what a link can carry', () => {
    const page = rewritePage(INDEX, { ...tags, title: 'Search: "a" <b> & c · Torahmap' });
    expect(page).toContain('<title>Search: &quot;a&quot; &lt;b&gt; &amp; c · Torahmap</title>');
    expect(content(page, 'property', 'og:title')).toBe(
      'Search: &quot;a&quot; &lt;b&gt; &amp; c · Torahmap',
    );
  });

  it('carries a search term that looks like a regex backreference', () => {
    const page = rewritePage(INDEX, { ...tags, title: 'Search: $& $1 · Torahmap' });
    expect(page).toContain('<title>Search: $&amp; $1 · Torahmap</title>');
    expect(content(page, 'property', 'og:title')).toBe('Search: $&amp; $1 · Torahmap');
  });
});
