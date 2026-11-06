import { describe, it, expect } from 'vitest';
import { pickQuick } from '../src/overlays/pickFinder.ts';

const chips = () => document.createElement('span');
const shown = (box: Node) =>
  !(box as HTMLElement).querySelector<HTMLElement>('.pick-quick-body')!.hidden;

describe('the quick picks', () => {
  it('show with no link while there are no results', () => {
    const [box, ...rest] = pickQuick('Most', [chips()], []);
    expect(rest).toEqual([]);
    expect((box as HTMLElement).querySelector('.pick-quick-link')).toBeNull();
    expect(shown(box)).toBe(true);
  });

  it('fold behind a link that shows and hides them, above the results', () => {
    const results = document.createElement('div');
    const [box, ...rest] = pickQuick('Most', [chips()], [results]);
    expect(rest).toEqual([results]);
    const link = (box as HTMLElement).querySelector<HTMLButtonElement>('.pick-quick-link')!;
    expect(shown(box)).toBe(false);
    link.click();
    expect(shown(box)).toBe(true);
    link.click();
    expect(shown(box)).toBe(false);
  });
});
