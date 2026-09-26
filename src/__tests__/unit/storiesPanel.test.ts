import { describe, it, expect } from 'vitest';
import { storiesHtml } from '../../storiesPanel';

function parse(html: string): HTMLDivElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

describe('storiesHtml', () => {
  it('names the stop the story is at', () => {
    const text = parse(storiesHtml({ number: 7, total: 21, label: "Abraham's call" })).textContent;
    expect(text).toContain('7 of 21');
    expect(text).toContain("Abraham's call");
  });

  it('offers to continue and to start again', () => {
    const actions = [
      ...parse(storiesHtml({ number: 7, total: 21, label: 'x' })).querySelectorAll<HTMLElement>(
        'button[data-action]',
      ),
    ].map((b) => b.dataset.action);
    expect(actions).toEqual(['story', 'restart']);
  });

  it('escapes the stop label', () => {
    const div = parse(storiesHtml({ number: 1, total: 1, label: '<img src=x>' }));
    expect(div.querySelector('img')).toBeNull();
  });
});
