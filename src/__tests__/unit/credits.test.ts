// Tests for the credits data and its renderer.
import { describe, it, expect } from 'vitest';
import { APP_CREDITS, renderCreditBlock, renderCreditsHtml, type Credit } from '../../credits';
import { registerAllOverlays, getAllOverlays } from '../../overlays/index';

registerAllOverlays();

/**
 * Overlays that add no source of their own. Both derive everything from text
 * that is already credited: Trop reads the cantillation marks out of the
 * Hebrew edition, and Verse Length counts characters. Anything else that
 * appears in the registry owes a credit.
 */
const OVERLAYS_WITHOUT_OWN_SOURCE = ['trop', 'verse-length'];

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

  it('says the collection date is not recorded when none is given', () => {
    expect(block([{ source: 'S', collected: 'September 2026' }])).toContain('September 2026');

    const unknown = block([{ source: 'S' }]);
    expect(unknown).toContain('not recorded');
    expect(unknown).not.toContain('undefined');
  });

  it('shows a note when one is given', () => {
    expect(block([{ source: 'S', note: 'Cite 10.17026/dans-z6y-skyh' }]))
      .toContain('Cite 10.17026/dans-z6y-skyh');
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

describe('APP_CREDITS', () => {
  it('names both pinned editions, which their licences require', () => {
    const sources = APP_CREDITS.map((c) => c.source).join(' | ');
    expect(sources).toContain('Miqra according to the Masorah');
    expect(sources).toContain('THE JPS TANAKH: Gender-Sensitive Edition');
  });

});

describe('Sefaria', () => {
  it('is credited somewhere, whichever block it sits in', () => {
    const all = [...APP_CREDITS, ...getAllOverlays().flatMap((o) => o.credits ?? [])];

    expect(all.some((c) => c.source.includes('Sefaria'))).toBe(true);
  });
});

describe('overlay credits', () => {
  it('credits every overlay that draws on a source of its own', () => {
    const uncredited = getAllOverlays()
      .filter((o) => !OVERLAYS_WITHOUT_OWN_SOURCE.includes(o.id))
      .filter((o) => !o.credits || o.credits.length === 0)
      .map((o) => o.id);

    expect(uncredited).toEqual([]);
  });

  it('names the sources the licences oblige us to name', () => {
    const sources = getAllOverlays().flatMap((o) => o.credits ?? []).map((c) => c.source).join(' | ');

    expect(sources).toContain('BHSA');
    expect(sources).toContain('Mechon Mamre');
    expect(sources).toContain('Dating the Bible');
  });

  it('cites the identifier the BHSA licence asks for', () => {
    const all = [...APP_CREDITS, ...getAllOverlays().flatMap((o) => o.credits ?? [])];
    const bhsa = all.find((c) => c.source.includes('BHSA'));

    expect(bhsa?.note).toContain('10.17026/dans-z6y-skyh');
  });

  it('links every credited source over https', () => {
    const all = [...APP_CREDITS, ...getAllOverlays().flatMap((o) => o.credits ?? [])];
    const bad = all.map((c) => c.url).filter((u) => u !== undefined && !u.startsWith('https://'));

    expect(bad).toEqual([]);
  });
});
