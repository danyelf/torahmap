import { describe, it, expect, vi } from 'vitest';
import type { GoTo, Reference } from '../src/app/text.ts';
import { nameCompleter } from '../src/references.ts';
import { bindGoTo, goToPanelHtml, GO_TO_BOX_ID } from '../src/goTo.ts';

const PLACES: Record<string, Reference> = {
  'genesis 1': { ref: 'Genesis 1', ids: ['Genesis.1.1', 'Genesis.1.2'] },
  'genesis 2:2': { ref: 'Genesis 2:2', ids: ['Genesis.2.2'] },
};

const goTo: GoTo = {
  examples: ['Genesis 2:2', 'שמות כב'],
  read: (typed) => PLACES[typed.trim().toLowerCase()] ?? null,
  complete: nameCompleter([
    { key: 'Genesis', names: ['Genesis'] },
    { key: 'Exodus', names: ['Exodus'] },
    { key: 'Ezra', names: ['Ezra'] },
  ]),
};

function open() {
  const panel = document.createElement('div');
  panel.innerHTML = goToPanelHtml(goTo.examples);
  document.body.replaceChildren(panel);
  const take = vi.fn();
  const quote = vi.fn((found: Reference) => `the text of ${found.ids[0]}`);
  bindGoTo(panel, goTo, { take, quote });
  const box = panel.querySelector<HTMLInputElement>(`#${GO_TO_BOX_ID}`)!;
  const type = (value: string) => {
    box.value = value;
    box.dispatchEvent(new Event('input'));
  };
  const press = (key: string) => box.dispatchEvent(new KeyboardEvent('keydown', { key }));
  const completions = () =>
    [...panel.querySelectorAll<HTMLElement>('[role="option"]')].map((o) => o.textContent);
  const selected = () => panel.querySelector('[aria-selected="true"]')?.textContent ?? null;
  return { panel, box, take, type, press, completions, selected };
}

describe('the Go to panel', () => {
  it('offers the place typed, quoting its first square, and goes there on Enter', () => {
    const { panel, take, type, press } = open();
    type('Genesis 1');
    expect(panel.querySelector('.goto-offer')?.textContent).toContain('the text of Genesis.1.1');
    press('Enter');
    expect(take).toHaveBeenCalledWith(PLACES['genesis 1']);
  });

  it('goes to the place when its offer is clicked', () => {
    const { panel, take, type } = open();
    type('Genesis 1');
    panel.querySelector<HTMLElement>('.goto-offer')!.click();
    expect(take).toHaveBeenCalledWith(PLACES['genesis 1']);
  });

  it('says when what is typed names nothing, and goes nowhere', () => {
    const { panel, take, type, press } = open();
    type('Genesis 99');
    expect(panel.querySelector('.goto-none')).not.toBeNull();
    expect(panel.querySelector('.goto-offer')).toBeNull();
    press('Enter');
    expect(take).not.toHaveBeenCalled();
  });

  it('answers nothing while empty', () => {
    const { panel, type } = open();
    type('  ');
    expect(panel.querySelector('.goto-answer')!.childElementCount).toBe(0);
  });

  it("puts an example in the box when it is clicked, and offers the example's place", () => {
    const { panel, box } = open();
    const examples = [...panel.querySelectorAll<HTMLElement>('.goto-example')];
    expect(examples.map((e) => e.textContent)).toEqual(goTo.examples);
    examples[0].click();
    expect(box.value).toBe('Genesis 2:2');
    expect(panel.querySelector('.goto-offer')?.textContent).toContain('Genesis 2:2');
  });

  it('offers the names that start as typed', () => {
    const { box, type, completions } = open();
    type('E');
    expect(completions()).toEqual(['Exodus', 'Ezra']);
    expect(box.getAttribute('aria-expanded')).toBe('true');
    type('Genesis 1');
    expect(completions()).toEqual([]);
    expect(box.getAttribute('aria-expanded')).toBe('false');
  });

  it('does not say Not found while it offers names', () => {
    const { panel, type } = open();
    type('E');
    expect(panel.querySelector('.goto-none')).toBeNull();
  });

  it('hides the examples while it offers names', () => {
    const { panel, type } = open();
    const examples = panel.querySelector<HTMLElement>('.goto-examples')!;
    type('E');
    expect(examples.hidden).toBe(true);
    type('Genesis 1');
    expect(examples.hidden).toBe(false);
  });

  it('moves through the names with the arrow keys, round to the box and back', () => {
    const { type, press, selected } = open();
    type('E');
    press('ArrowDown');
    expect(selected()).toBe('Exodus');
    press('ArrowDown');
    expect(selected()).toBe('Ezra');
    press('ArrowDown');
    expect(selected()).toBeNull();
    press('ArrowUp');
    expect(selected()).toBe('Ezra');
  });

  it('completes the chosen name with Enter, ready for the numbers, and goes nowhere', () => {
    const { box, take, type, press, completions } = open();
    type('E');
    press('ArrowDown');
    press('Enter');
    expect(box.value).toBe('Exodus ');
    expect(completions()).toEqual([]);
    expect(take).not.toHaveBeenCalled();
  });

  it('completes a name when it is tapped', () => {
    const { panel, box, type } = open();
    type('Ez');
    panel.querySelector<HTMLElement>('[role="option"]')!.click();
    expect(box.value).toBe('Ezra ');
    expect(document.activeElement).toBe(box);
  });

  it('closes the names with Escape, keeping what was typed', () => {
    const { box, type, press, completions } = open();
    type('E');
    press('Escape');
    expect(completions()).toEqual([]);
    expect(box.value).toBe('E');
  });
});
