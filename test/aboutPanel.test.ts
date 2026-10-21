import { describe, it, expect, beforeEach, vi } from 'vitest';

async function about(): Promise<HTMLDivElement> {
  vi.resetModules();
  // The registry fills when the overlays register, so the panel is built after that.
  const { registerAllOverlays } = await import('@torahmap/tanakh/overlays/index.ts');
  registerAllOverlays();
  const { getAllOverlays } = await import('@torahmap/tanakh/overlays/registry.ts');
  const { aboutHtml } = await import('../packages/shell/src/aboutPanel.ts');
  const { tanakhSite } = await import('@torahmap/tanakh/site.ts');
  const div = document.createElement('div');
  div.innerHTML = aboutHtml(tanakhSite, getAllOverlays(), true, ['Genesis 1']);
  return div;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('the About panel', () => {
  it('offers a text with two languages a named button for each choice', async () => {
    const buttons = [
      ...(await about()).querySelectorAll<HTMLButtonElement>('#language-choice button'),
    ];
    expect(buttons.map((b) => b.dataset.languages)).toEqual(['he', 'both', 'en']);
    for (const b of buttons) {
      expect(b.type).toBe('button');
      expect(b.querySelector('.visually-hidden')?.textContent?.trim()).toBeTruthy();
    }
  });

  it('names the language choice by its visible caption', async () => {
    const div = await about();
    const group = div.querySelector('#language-choice')!;
    const caption = div.querySelector(`#${group.getAttribute('aria-labelledby')}`);
    expect(caption?.textContent?.trim()).toBeTruthy();
  });

  it('offers no choice, and no empty Settings, to a text with one language', async () => {
    const { aboutHtml } = await import('../packages/shell/src/aboutPanel.ts');
    const { talmudSite } = await import('@torahmap/talmud/site.ts');
    const div = document.createElement('div');
    div.innerHTML = aboutHtml(talmudSite, [], false, ['Genesis 1']);
    expect(div.querySelector('#language-choice')).toBeNull();
    expect(div.querySelectorAll('.about-section')).toHaveLength(
      (await about()).querySelectorAll('.about-section').length - 1,
    );
  });

  it('says what the map is and who made it', async () => {
    const text = (await about()).textContent ?? '';
    expect(text).toContain('Torahmap');
    expect(text).toContain('Danyel Fisher');
  });

  it('names its icon links for screen readers', async () => {
    const links = [...(await about()).querySelectorAll('.byline-icon')];
    expect(links.map((a) => a.getAttribute('aria-label'))).toEqual(['GitHub', 'Email']);
    expect(links[1].getAttribute('href')).toMatch(/^mailto:/);
  });

  it('lists the controls', async () => {
    expect((await about()).querySelectorAll('.controls-table tr').length).toBeGreaterThan(0);
  });

  it('carries the credits, the map first', async () => {
    const titles = [...(await about()).querySelectorAll('.credit-block-title')].map(
      (h) => h.textContent,
    );
    expect(titles[0]).toBe('The map itself');
    expect(titles.length).toBeGreaterThan(1);
  });

  it('is about the text it is given, with that text’s credits', async () => {
    const { aboutHtml } = await import('../packages/shell/src/aboutPanel.ts');
    const { talmudSite } = await import('@torahmap/talmud/site.ts');
    const div = document.createElement('div');
    div.innerHTML = aboutHtml(talmudSite, [], false, ['Genesis 1']);
    expect(div.textContent).toContain(talmudSite.page.name);
    const { tanakhSite } = await import('@torahmap/tanakh/site.ts');
    expect(div.textContent).not.toContain(tanakhSite.page.name);
    expect(div.querySelector('.controls-table')?.textContent).not.toContain(tanakhSite.squareName);
    expect([...div.querySelectorAll('.credit-source')].map((s) => s.textContent)).toEqual(
      talmudSite.credits.map((c) => c.source),
    );
  });

  it('opens every source link in a new tab, safely', async () => {
    for (const a of (await about()).querySelectorAll<HTMLAnchorElement>('.credits-list a')) {
      expect(a.target).toBe('_blank');
      expect(a.rel).toContain('noopener');
    }
  });
});
