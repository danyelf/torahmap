import { describe, it, expect } from 'vitest';
import { menuHtml } from '../../menu';
import { tanakhSite } from '../../tanakh/site';
import { talmudSite } from '../../talmud/site';

function items(html: string): HTMLButtonElement[] {
  const div = document.createElement('div');
  div.innerHTML = html;
  return [...div.querySelectorAll<HTMLButtonElement>('button.menu-item')];
}

describe('menuHtml', () => {
  it('offers the current story first, by name, with where it is', () => {
    const [first] = items(menuHtml(tanakhSite, { number: 7, total: 21, title: 'The guided tour' }));
    expect(first.dataset.action).toBe('story');
    expect(first.textContent).toContain('Continue The guided tour');
    expect(first.textContent).toContain('7/21');
  });

  it("escapes the story's title", () => {
    const div = document.createElement('div');
    div.innerHTML = menuHtml(tanakhSite, { number: 1, total: 2, title: '<img src=x>' });
    expect(div.querySelector('img')).toBeNull();
  });

  it('then share, the search, the overlays, the stories, and about', () => {
    const actions = items(menuHtml(tanakhSite, { number: 1, total: 21, title: 'x' })).map(
      (b) => b.dataset.action,
    );
    expect(actions).toEqual(['story', 'share', 'search', 'overlay', 'stories', 'about']);
  });

  it('makes every item a real button', () => {
    for (const b of items(menuHtml(tanakhSite, { number: 1, total: 2, title: 'x' })))
      expect(b.type).toBe('button');
  });

  it("is headed with the site's name", () => {
    const div = document.createElement('div');
    div.innerHTML = menuHtml(talmudSite, { number: 1, total: 2, title: 'x' });
    expect(div.firstElementChild?.textContent).toBe(talmudSite.name);
  });

  it('sets the two actions apart from the tools', () => {
    const div = document.createElement('div');
    div.innerHTML = menuHtml(tanakhSite, { number: 1, total: 2, title: 'x' });
    const share = div.querySelector('[data-action="share"]');
    expect(share?.nextElementSibling?.classList.contains('menu-divider')).toBe(true);
  });
});
