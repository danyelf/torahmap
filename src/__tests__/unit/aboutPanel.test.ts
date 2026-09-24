import { describe, it, expect, beforeEach, vi } from 'vitest';

async function about(): Promise<HTMLDivElement> {
  vi.resetModules();
  // The registry fills when the overlays register, so the panel is built after that.
  const { registerAllOverlays } = await import('../../overlays/index');
  registerAllOverlays();
  const { getAllOverlays } = await import('../../overlays/registry');
  const { aboutHtml } = await import('../../aboutPanel');
  const div = document.createElement('div');
  div.innerHTML = aboutHtml(getAllOverlays());
  return div;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('the About panel', () => {
  it('offers the Hebrew toggle as a button', async () => {
    const div = await about();
    const toggle = div.querySelector<HTMLButtonElement>('#hebrew-toggle');
    expect(toggle?.type).toBe('button');
  });

  it('says what the map is and who made it', async () => {
    const text = (await about()).textContent ?? '';
    expect(text).toContain('Torahmap');
    expect(text).toContain('Danyel Fisher');
  });

  it('lists the controls', async () => {
    expect((await about()).querySelector('.controls-table')).not.toBeNull();
  });

  it('carries the credits, the map first', async () => {
    const titles = [...(await about()).querySelectorAll('.credit-block-title')].map(
      (h) => h.textContent,
    );
    expect(titles[0]).toBe('The map itself');
    expect(titles.length).toBeGreaterThan(1);
  });

  it('opens every source link in a new tab, safely', async () => {
    for (const a of (await about()).querySelectorAll<HTMLAnchorElement>('.credits-list a')) {
      expect(a.target).toBe('_blank');
      expect(a.rel).toContain('noopener');
    }
  });
});
