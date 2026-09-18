// Tests for the help modal, and in particular its Credits tab.
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * help.ts caches the modal in module state, so each test gets a fresh copy of
 * the module rather than one left over from the test before.
 *
 * The overlay registry is module state too, and the order here matters: main.ts
 * imports help.ts at load and only calls registerAllOverlays() later, so help.ts
 * must be imported against an empty registry for these tests to mean anything.
 * Registering first would let a credits tab built at import time still pass.
 */
async function openHelp(): Promise<HTMLElement> {
  vi.resetModules();
  document.body.innerHTML = '';
  localStorage.clear();

  const { initHelp } = await import('../../help');

  const { registerAllOverlays } = await import('../../overlays/index');
  registerAllOverlays();
  const panel = document.createElement('div');
  document.body.appendChild(panel);
  initHelp(panel);
  document.getElementById('help-btn')!.click();

  return document.getElementById('help-modal') as HTMLElement;
}

/**
 * The registry help.ts is reading. It must be fetched after openHelp, from the
 * same post-reset module graph — a static import would hold a different,
 * empty copy.
 */
async function registeredOverlays() {
  const { getAllOverlays } = await import('../../overlays/index');
  return getAllOverlays();
}

function clickTab(modal: HTMLElement, tab: string): void {
  modal.querySelector<HTMLElement>(`.help-tab[data-tab="${tab}"]`)!.click();
}

const bodyText = (modal: HTMLElement) => modal.querySelector('.help-body')!.textContent ?? '';

describe('help modal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stays closed until the reader asks for it', async () => {
    vi.resetModules();
    document.body.innerHTML = '';
    const { initHelp } = await import('../../help');
    initHelp(document.body);

    expect(document.getElementById('help-modal')).toBeNull();
  });

  it('opens from the help button and offers a Credits tab', async () => {
    const modal = await openHelp();

    expect(modal.classList.contains('visible')).toBe(true);
    expect(modal.querySelector('.help-tab[data-tab="credits"]')).not.toBeNull();
  });

  it('remembers which tab was last open', async () => {
    const modal = await openHelp();
    clickTab(modal, 'credits');

    expect(localStorage.getItem('torahMap.helpTab')).toBe('credits');
  });
});

describe('overlays tab', () => {
  it('names every overlay the app registers, in the order the menu offers them', async () => {
    const modal = await openHelp();
    clickTab(modal, 'overlays');

    const named = [...modal.querySelectorAll('.overlay-list dt')].map((dt) => dt.textContent);
    const registered = (await registeredOverlays()).map((o) => o.name);

    // Without this the assertion would pass on an empty registry and an empty
    // tab, which is the very thing it exists to rule out.
    expect(registered.length).toBeGreaterThan(1);
    expect(named).toEqual(registered);
  });

  it('gives every overlay a description of its own', async () => {
    const overlays = await registeredOverlays();

    // An overlay that says nothing about itself is skipped by the renderer, so
    // it would go missing from the tab quietly. This is where that fails.
    const silent = overlays.filter((o) => !o.description?.trim()).map((o) => o.name);
    expect(silent).toEqual([]);
  });

  it('shows each description under its overlay', async () => {
    const modal = await openHelp();
    clickTab(modal, 'overlays');

    const shown = [...modal.querySelectorAll('.overlay-list dd')].map((dd) => dd.textContent);
    const declared = (await registeredOverlays()).map((o) => o.description);

    expect(shown).toEqual(declared);
  });

  it('builds from the registry when the tab is opened, not at import time', async () => {
    // openHelp imports help.ts against an empty registry and registers
    // afterwards, so a tab built at import time would come out empty here.
    const modal = await openHelp();
    clickTab(modal, 'overlays');

    expect(modal.querySelectorAll('.overlay-list dt').length).toBe(
      (await registeredOverlays()).length,
    );
  });
});

describe('credits tab', () => {
  /** Overlays the registry holds that have something to declare. */
  const withCredits = (overlays: { name: string; credits?: readonly unknown[] }[]) =>
    overlays.filter((o) => o.credits && o.credits.length > 0);

  it("heads one block per crediting overlay, under that overlay's own name", async () => {
    const modal = await openHelp();
    clickTab(modal, 'credits');

    const headings = [...modal.querySelectorAll('.credit-block-title')].map((h) => h.textContent);
    const expected = withCredits(await registeredOverlays()).map((o) => o.name);

    // One block per crediting overlay, in registry order, after the block for
    // what the map itself rests on.
    expect(headings.slice(1)).toEqual(expected);
  });

  it('leaves out overlays that declare nothing', async () => {
    const modal = await openHelp();
    clickTab(modal, 'credits');

    const headings = [...modal.querySelectorAll('.credit-block-title')].map((h) => h.textContent);
    const silent = (await registeredOverlays())
      .filter((o) => !o.credits || o.credits.length === 0)
      .map((o) => o.name);

    expect(silent.filter((name) => headings.includes(name))).toEqual([]);
  });

  it('builds from the registry when the tab is opened, not at import time', async () => {
    const modal = await openHelp();
    clickTab(modal, 'credits');

    const expected = withCredits(await registeredOverlays()).length + 1;

    // Without this the assertion would pass on an empty registry, which is the
    // very thing it exists to rule out.
    expect(expected).toBeGreaterThan(1);
    expect(modal.querySelectorAll('.credit-block').length).toBe(expected);
  });

  it('shows a row for every credit declared', async () => {
    const modal = await openHelp();
    clickTab(modal, 'credits');

    const declared = (await registeredOverlays()).flatMap((o) => o.credits ?? []).length;

    expect(modal.querySelectorAll('.credit-row').length).toBeGreaterThan(declared);
  });

  it('opens every source link in a new tab, safely', async () => {
    const modal = await openHelp();
    clickTab(modal, 'credits');

    const links = [...modal.querySelectorAll<HTMLAnchorElement>('.help-body a')];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.target).toBe('_blank');
      expect(link.rel).toBe('noopener noreferrer');
    }
  });
});

describe('overview byline', () => {
  it('carries no credit blocks of its own', async () => {
    const modal = await openHelp();

    expect(modal.querySelectorAll('.credit-block')).toHaveLength(0);
    expect(modal.querySelector('.credits')).not.toBeNull();
  });

  it('links through to the credits tab', async () => {
    const modal = await openHelp();

    const link = modal.querySelector<HTMLElement>('[data-goto-tab="credits"]');
    expect(link).not.toBeNull();

    link!.click();

    expect(modal.querySelector('.help-tab.active')?.getAttribute('data-tab')).toBe('credits');
    expect(modal.querySelectorAll('.credit-block').length).toBeGreaterThan(0);
  });
});
