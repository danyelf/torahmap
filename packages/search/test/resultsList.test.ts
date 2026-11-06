import { describe, expect, it } from 'vitest';
import { createResultsList, type ResultRow } from '../src/resultsList.ts';

const toRow =
  (tag = ''): ((n: number) => ResultRow) =>
  (n) => ({ colors: [], ref: `${tag}${n}`, snippet: document.createTextNode(''), onSelect() {} });
const numbers = (count: number) => Array.from({ length: count }, (_, i) => i);
const refs = (container: HTMLElement) =>
  [...container.querySelectorAll('.search-result .ref')].map((el) => el.textContent);

/** A container that reports itself scrolled to its bottom. */
function scrollable() {
  const container = document.createElement('div');
  for (const [name, value] of [
    ['scrollHeight', 1000],
    ['clientHeight', 300],
  ] as const)
    Object.defineProperty(container, name, { value });
  return container;
}
const scrollToBottom = (container: HTMLElement) => {
  container.scrollTop = 700;
  container.dispatchEvent(new Event('scroll'));
};

describe('the results list', () => {
  it('draws a batch of the rows, and more as the reader scrolls to the end', () => {
    const container = scrollable();
    createResultsList<number>().render(container, numbers(500), toRow());
    const first = refs(container).length;
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(500);
    scrollToBottom(container);
    expect(refs(container).length).toBeGreaterThan(first);
    expect(refs(container).slice(0, 3)).toEqual(['0', '1', '2']);
  });

  it('draws everything at once when it is a short list', () => {
    const container = scrollable();
    createResultsList<number>().render(container, numbers(3), toRow());
    expect(refs(container)).toEqual(['0', '1', '2']);
  });

  it('starts over from the top when given a new list', () => {
    const container = scrollable();
    const list = createResultsList<number>();
    list.render(container, numbers(500), toRow());
    list.render(container, [7, 8], toRow());
    expect(refs(container)).toEqual(['7', '8']);
  });

  it('draws the rows already drawn again, and the batches that follow in the new way', () => {
    const container = scrollable();
    const list = createResultsList<number>();
    list.render(container, numbers(500), toRow());
    const first = refs(container).length;
    list.redraw(container, toRow('~'));
    expect(refs(container)).toHaveLength(first);
    expect(refs(container)[0]).toBe('~0');
    scrollToBottom(container);
    expect(refs(container)[first]).toBe(`~${first}`);
  });

  it('draws a dot as an outline when its place is hollow', () => {
    const container = scrollable();
    createResultsList<number>().render(container, [0], () => ({
      ...toRow()(0),
      colors: [
        [1, 0, 0],
        [0, 1, 0],
      ],
      hollow: new Set([1]),
    }));
    const [filled, hollow] = [...container.querySelectorAll<HTMLElement>('.term-dot')];
    expect(filled.style.background).not.toBe('');
    expect(hollow.style.background).toBe('');
    expect(hollow.style.boxShadow).not.toBe('');
  });
});
