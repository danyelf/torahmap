import { describe, it, expect } from 'vitest';
import { menuHtml } from '../packages/shell/src/menu.ts';
import { SHORTCUT_KEYS, shortcutLabel } from '../packages/shell/src/shortcuts.ts';
import { PANELS } from '../packages/shell/src/frame.ts';
import { tanakhSite } from '@torahmap/tanakh/site.ts';
import { talmudSite } from '@torahmap/talmud/site.ts';

function items(html: string): HTMLButtonElement[] {
  const div = document.createElement('div');
  div.innerHTML = html;
  return [...div.querySelectorAll<HTMLButtonElement>('button.menu-item')];
}

const MAC = true;

describe('menuHtml', () => {
  it('offers the current story first, by name, with where it is', () => {
    const [first] = items(
      menuHtml(tanakhSite, { number: 7, total: 21, title: 'The guided tour' }, PANELS, MAC),
    );
    expect(first.dataset.action).toBe('story');
    expect(first.textContent).toContain('Continue The guided tour');
    expect(first.textContent).toContain('7/21');
  });

  it("escapes the story's title", () => {
    const div = document.createElement('div');
    div.innerHTML = menuHtml(
      tanakhSite,
      { number: 1, total: 2, title: '<img src=x>' },
      PANELS,
      MAC,
    );
    expect(div.querySelector('img')).toBeNull();
  });

  it('then share, go to, the search, the overlays, the stories, and about', () => {
    const actions = items(
      menuHtml(tanakhSite, { number: 1, total: 21, title: 'x' }, PANELS, MAC),
    ).map((b) => b.dataset.action);
    expect(actions).toEqual(['story', 'share', 'goto', 'search', 'overlay', 'stories', 'about']);
  });

  it('offers only the panels the text has', () => {
    const actions = items(
      menuHtml(tanakhSite, { number: 1, total: 2, title: 'x' }, ['search', 'about'], MAC),
    ).map((b) => b.dataset.action);
    expect(actions).toEqual(['story', 'share', 'search', 'about']);
  });

  it('makes every item a real button', () => {
    for (const b of items(menuHtml(tanakhSite, { number: 1, total: 2, title: 'x' }, PANELS, MAC)))
      expect(b.type).toBe('button');
  });

  it("is headed with the site's name", () => {
    const div = document.createElement('div');
    div.innerHTML = menuHtml(talmudSite, { number: 1, total: 2, title: 'x' }, PANELS, MAC);
    expect(div.firstElementChild?.textContent).toBe(talmudSite.page.name);
  });

  it('sets the two actions apart from the tools', () => {
    const div = document.createElement('div');
    div.innerHTML = menuHtml(tanakhSite, { number: 1, total: 2, title: 'x' }, PANELS, MAC);
    const share = div.querySelector('[data-action="share"]');
    expect(share?.nextElementSibling?.classList.contains('menu-divider')).toBe(true);
  });

  it("shows Search's and Go to's shortcuts, written for the platform, and none beside the rest", () => {
    const shown = (mac: boolean) =>
      Object.fromEntries(
        items(menuHtml(tanakhSite, { number: 1, total: 2, title: 'x' }, PANELS, mac)).map((b) => [
          b.dataset.action,
          b.querySelector('.menu-shortcut')?.textContent,
        ]),
      );
    for (const mac of [true, false]) {
      expect(shown(mac).search).toBe(shortcutLabel(SHORTCUT_KEYS.find, mac));
      expect(shown(mac).goto).toBe(shortcutLabel(SHORTCUT_KEYS.goTo, mac));
    }
    expect(shown(true).search).not.toBe(shown(false).search);
    const rest = { ...shown(true), search: undefined, goto: undefined };
    expect(Object.values(rest).every((hint) => hint === undefined)).toBe(true);
  });
});
