import { describe, it, expect } from 'vitest';
import {
  startingPointsHtml,
  startChosen,
  type StartOverlay,
  type StartStory,
} from '../../startingPoints';

const OVERLAYS: StartOverlay[] = [
  { id: 'colours', name: 'Colours', tagline: 'Paints the verses.' },
  { id: 'shades', name: 'Shades', tagline: 'Shades the verses.' },
];

const STORIES: StartStory[] = [
  { id: 'tour', title: 'The Guided Tour', description: 'Follows Abraham.' },
  { id: 'job', title: 'Prose and Poetry', description: 'Job on the map.' },
];

function parse(html: string): HTMLDivElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

const buttons = (div: Element): HTMLButtonElement[] => [...div.querySelectorAll('button')];

describe('the starting points', () => {
  const div = parse(startingPointsHtml(OVERLAYS, STORIES));

  it('offers search, then every overlay and every story, in order, under a heading each', () => {
    expect(buttons(div).map((b) => startChosen(b))).toEqual([
      { kind: 'search' },
      { kind: 'overlay', id: 'colours' },
      { kind: 'overlay', id: 'shades' },
      { kind: 'story', id: 'tour' },
      { kind: 'story', id: 'job' },
    ]);
    expect(div.querySelectorAll('h3')).toHaveLength(2);
  });

  it('puts an overlay’s tagline and a story’s description in its button', () => {
    const [, colours, , tour] = buttons(div);
    expect(colours.textContent).toContain('Paints the verses.');
    expect(tour.textContent).toContain('Follows Abraham.');
  });

  it('finds the choice from anywhere inside a button', () => {
    const label = buttons(div)[0].firstElementChild!;
    expect(startChosen(label)).toEqual({ kind: 'search' });
  });

  it('finds no choice outside its buttons', () => {
    expect(startChosen(div)).toBeNull();
  });
});
