import { describe, it, expect } from 'vitest';
import { menuHtml } from '../../menu';

function items(html: string): HTMLButtonElement[] {
  const div = document.createElement('div');
  div.innerHTML = html;
  return [...div.querySelectorAll<HTMLButtonElement>('button.menu-item')];
}

describe('menuHtml', () => {
  it('offers the story first, with where it is', () => {
    const [first] = items(menuHtml({ number: 7, total: 21 }));
    expect(first.dataset.action).toBe('story');
    expect(first.textContent).toContain('Continue the story');
    expect(first.textContent).toContain('7 of 21');
  });

  it('then the overlays, the stories, and about', () => {
    const actions = items(menuHtml({ number: 1, total: 21 })).map((b) => b.dataset.action);
    expect(actions).toEqual(['story', 'overlay', 'stories', 'about']);
  });

  it('makes every item a real button', () => {
    for (const b of items(menuHtml({ number: 1, total: 2 }))) expect(b.type).toBe('button');
  });
});
