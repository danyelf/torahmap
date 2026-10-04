import { describe, it, expect } from 'vitest';
import { startingPointsHtml, startChosen, type StartStory } from '../../startingPoints';

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
  const div = parse(startingPointsHtml(STORIES));

  it('offers search, then the overlays and the stories under a heading each', () => {
    const choices = buttons(div).map((b) => startChosen(b));
    expect(choices).toEqual([
      { kind: 'search' },
      { kind: 'overlay', id: 'haftarah', params: {} },
      { kind: 'overlay', id: 'commentary', params: {} },
      { kind: 'overlay', id: 'trop', params: { trop: 'geresh' } },
      { kind: 'overlay', id: 'verse-length', params: {} },
      { kind: 'story', id: 'tour' },
      { kind: 'story', id: 'job' },
    ]);
    expect(div.querySelectorAll('h3')).toHaveLength(2);
  });

  it('names each story by its title, with its description beside it', () => {
    const row = buttons(div).find((b) => startChosen(b)?.kind === 'story')!.parentElement!;
    expect(row.textContent).toContain('The Guided Tour');
    expect(row.textContent).toContain('Follows Abraham.');
  });

  it('finds the choice from anywhere inside a button', () => {
    const label = buttons(div)[0].firstElementChild ?? buttons(div)[0];
    expect(startChosen(label)).toEqual({ kind: 'search' });
  });

  it('finds no choice outside its buttons', () => {
    expect(startChosen(div)).toBeNull();
  });
});
