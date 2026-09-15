// Tests for the credits data and its renderer.
import { describe, it, expect } from 'vitest';
import { APP_CREDITS, renderCreditBlock, renderCreditsHtml, type Credit } from '../../credits';
import { registerAllOverlays, getAllOverlays } from '../../overlays/index';

registerAllOverlays();

/**
 * Overlays that owe no credit. Trop reads the cantillation marks out of the
 * Hebrew edition and Verse Length counts characters, so both derive everything
 * from text that is already credited. Haftarah is a different case: which
 * passage is read on which occasion is recorded in many places, so the readings
 * are not any one source's work. Anything else in the registry owes a credit.
 */
const OVERLAYS_WITHOUT_OWN_SOURCE = ['trop', 'verse-length', 'haftarah'];

const block = (credits: readonly Credit[]) => renderCreditBlock('A Heading', credits);

describe('renderCreditBlock', () => {
  it('heads the block and lists the source', () => {
    const html = renderCreditBlock('Text Dating', [{ source: 'Wikipedia' }]);
    expect(html).toContain('Text Dating');
    expect(html).toContain('Wikipedia');
  });

  it('renders nothing at all for an empty credit list', () => {
    expect(renderCreditBlock('Trop', [])).toBe('');
  });

  it('renders a source with a url as a link that opens safely', () => {
    const html = block([{ source: 'BHSA', url: 'https://github.com/ETCBC/bhsa' }]);
    expect(html).toContain('href="https://github.com/ETCBC/bhsa"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('renders a source without a url as plain text, not an empty link', () => {
    const el = document.createElement('div');
    el.innerHTML = block([{ source: 'Sefaria link exports' }]);

    expect(el.textContent).toContain('Sefaria link exports');
    expect(el.querySelectorAll('a')).toHaveLength(0);
  });

  it('shows the licence when there is one and omits the pill when there is not', () => {
    const withLicence = block([{ source: 'S', license: 'CC BY-SA' }]);
    expect(withLicence).toContain('CC BY-SA');
    expect(withLicence).toContain('credit-license');

    expect(block([{ source: 'S' }])).not.toContain('credit-license');
  });

  it('links the licence when a deed url is given', () => {
    const el = document.createElement('div');
    el.innerHTML = block([
      { source: 'S', license: 'CC BY-SA 4.0', licenseUrl: 'https://example.test/by-sa/4.0/' },
    ]);
    const pill = el.querySelector('a.credit-license');

    expect(pill).not.toBeNull();
    expect(pill!.getAttribute('href')).toBe('https://example.test/by-sa/4.0/');
    expect(pill!.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('leaves the licence as plain text when no deed url is given', () => {
    const el = document.createElement('div');
    el.innerHTML = block([{ source: 'S', license: 'CC BY-NC' }]);

    expect(el.querySelector('a.credit-license')).toBeNull();
    expect(el.querySelector('span.credit-license')).not.toBeNull();
  });

  it('says the collection date is not recorded when none is given', () => {
    expect(block([{ source: 'S', collected: 'September 2026' }])).toContain('September 2026');

    const unknown = block([{ source: 'S' }]);
    expect(unknown).toContain('not recorded');
    expect(unknown).not.toContain('undefined');
  });

  it('shows a note when one is given', () => {
    expect(block([{ source: 'S', note: 'Cite 10.17026/dans-z6y-skyh' }])).toContain(
      'Cite 10.17026/dans-z6y-skyh',
    );
  });

  it('escapes values rather than letting them become markup', () => {
    const html = block([{ source: '<script>x</script>', note: 'a & b' }]);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a &amp; b');
  });

  it('escapes a url rather than letting a quote break out of the attribute', () => {
    const html = block([{ source: 'S', url: 'https://x.test/?a="b' }]);
    expect(html).toContain('&quot;');
    expect(html).not.toContain('?a="b');
  });
});

describe('renderCreditsHtml', () => {
  it('puts what the whole map rests on above what each overlay adds', () => {
    const html = renderCreditsHtml([{ name: 'Text Search', credits: [{ source: 'BHSA' }] }]);
    const base = html.indexOf('Miqra according to the Masorah');
    const overlay = html.indexOf('BHSA');

    expect(base).toBeGreaterThan(-1);
    expect(overlay).toBeGreaterThan(base);
  });

  it('leaves out overlays that declare no credits', () => {
    const html = renderCreditsHtml([
      { name: 'Verse Length' },
      { name: 'Haftarah', credits: [{ source: 'Mechon Mamre' }] },
    ]);

    expect(html).not.toContain('Verse Length');
    expect(html).toContain('Mechon Mamre');
  });
});

describe('the credits the app ships', () => {
  const everyCredit = () => [...APP_CREDITS, ...getAllOverlays().flatMap((o) => o.credits ?? [])];

  it('credits every overlay that draws on a source of its own', () => {
    const uncredited = getAllOverlays()
      .filter((o) => !OVERLAYS_WITHOUT_OWN_SOURCE.includes(o.id))
      .filter((o) => !o.credits || o.credits.length === 0)
      .map((o) => o.id);

    expect(uncredited).toEqual([]);
  });

  it('says what the map itself rests on', () => {
    expect(APP_CREDITS.length).toBeGreaterThan(0);
  });

  it('gives every credit something to show', () => {
    const empty = everyCredit().filter((c) => c.source.trim() === '');

    expect(empty).toEqual([]);
  });

  it('links every source it links over https', () => {
    const bad = everyCredit()
      .flatMap((c) => [c.url, c.licenseUrl])
      .filter((u) => u !== undefined && !u.startsWith('https://'));

    expect(bad).toEqual([]);
  });

  it('links the deed for every licence that states a version', () => {
    // Creative Commons 4.0 asks for a link to the licence alongside the
    // attribution. A version we are confident enough to print is a version we
    // are confident enough to link.
    const unlinked = everyCredit()
      .filter((c) => c.license !== undefined && /\d+\.\d+/.test(c.license))
      .filter((c) => c.licenseUrl === undefined)
      .map((c) => c.source);

    expect(unlinked).toEqual([]);
  });
});
