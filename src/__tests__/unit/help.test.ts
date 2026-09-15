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

  // With nothing seen yet, initHelp opens the modal itself.
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

  it('opens on a first visit and offers a Credits tab', async () => {
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

describe('credits tab', () => {
  it('credits what the whole map rests on', async () => {
    const modal = await openHelp();
    clickTab(modal, 'credits');
    const text = bodyText(modal);

    expect(text).toContain('Miqra according to the Masorah');
    expect(text).toContain('THE JPS TANAKH: Gender-Sensitive Edition');
    expect(text).toContain('Sefaria');
  });

  it('credits each overlay that draws on a source of its own, under its own name', async () => {
    const modal = await openHelp();
    clickTab(modal, 'credits');
    const text = bodyText(modal);

    expect(text).toContain('Text Search');
    expect(text).toContain('BHSA');
    expect(text).toContain('Haftarah');
    expect(text).toContain('Mechon Mamre');
    expect(text).toContain('Text Dating');
    expect(text).toContain('Dating the Bible');
  });

  it('leaves out overlays that add no source of their own', async () => {
    const modal = await openHelp();
    clickTab(modal, 'credits');

    const headings = [...modal.querySelectorAll('.credit-block-title')].map((h) => h.textContent);
    expect(headings).not.toContain('Trop');
    expect(headings).not.toContain('Verse Length');
  });

  it('builds from the registry when the tab is opened, not at import time', async () => {
    const modal = await openHelp();
    clickTab(modal, 'credits');

    // Every overlay with credits contributes a block, plus one for the map
    // itself. Derived rather than hard-coded, so adding or dropping an overlay
    // does not mean editing a number here.
    const overlays = await registeredOverlays();
    const expected = overlays.filter((o) => o.credits && o.credits.length > 0).length + 1;

    // Without this the assertion would pass on an empty registry, which is the
    // very thing it exists to rule out.
    expect(expected).toBeGreaterThan(1);
    expect(modal.querySelectorAll('.credit-block').length).toBe(expected);
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
  it('no longer carries the long credits paragraphs', async () => {
    const modal = await openHelp();
    const text = bodyText(modal);

    expect(text).not.toContain('Miqra according to the Masorah');
    expect(text).toContain('Danyel Fisher');
  });

  it('links through to the credits tab', async () => {
    const modal = await openHelp();

    const link = modal.querySelector<HTMLElement>('[data-goto-tab="credits"]');
    expect(link).not.toBeNull();

    link!.click();
    expect(bodyText(modal)).toContain('Mechon Mamre');
  });
});
