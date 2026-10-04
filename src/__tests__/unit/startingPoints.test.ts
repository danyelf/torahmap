import { describe, it, expect } from 'vitest';
import {
  startingPointsHtml,
  startChosen,
  type StartOverlay,
  type StartStory,
} from '../../startingPoints';

const SEARCH: StartOverlay = { id: 'search', name: 'Find', description: 'Finds a word.' };

const OVERLAYS: StartOverlay[] = [
  { id: 'colours', name: 'Colours', description: 'Paints the verses. Brighter is more.' },
  { id: 'shades', name: 'Shades', description: 'Shades the verses.' },
];

const STORIES: StartStory[] = [
  { id: 'tour', data: { title: 'The Guided Tour', description: 'Follows Abraham.' } },
  { id: 'job', data: { title: 'Prose and Poetry', description: 'Job on the map.' } },
];

function parse(html: string): HTMLDivElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

const buttons = (div: Element): HTMLButtonElement[] => [...div.querySelectorAll('button')];

describe('the starting points', () => {
  const div = parse(startingPointsHtml(SEARCH, OVERLAYS, STORIES));

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

  it('names each button, with the first sentence of a tool’s description or a story’s description', () => {
    const [search, colours, , tour] = buttons(div);
    expect(search.textContent).toContain('Find');
    expect(search.textContent).toContain('Finds a word.');
    expect(colours.textContent).toContain('Paints the verses.');
    expect(colours.textContent).not.toContain('Brighter is more.');
    expect(tour.textContent).toContain('The Guided Tour');
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
