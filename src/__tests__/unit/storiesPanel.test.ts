import { describe, it, expect } from 'vitest';
import { storiesHtml, storyChosen, type StoryCard } from '../../storiesPanel';

const card = (over: Partial<StoryCard>): StoryCard => ({
  id: 'tour',
  title: 'The guided tour',
  description: 'What the map shows.',
  draft: false,
  place: null,
  ...over,
});

function parse(html: string): HTMLDivElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

const actions = (el: Element): string[] =>
  [...el.querySelectorAll<HTMLElement>('button[data-action]')].map(
    (b) =>
      `${b.dataset.action}:${b.closest<HTMLElement>('[data-story]')?.dataset.story}:${b.dataset.from}`,
  );

describe('storiesHtml', () => {
  it('draws a card per story, in order, with its title and description', () => {
    const div = parse(storiesHtml([card({}), card({ id: 'job', title: 'Job' })]));
    const cards = [...div.querySelectorAll<HTMLElement>('.story-card')];
    expect(cards.map((c) => c.dataset.story)).toEqual(['tour', 'job']);
    expect(cards[0].textContent).toContain('What the map shows.');
    expect(cards[1].textContent).toContain('Job');
  });

  it('offers a story not yet read from its start', () => {
    expect(actions(parse(storiesHtml([card({})])))).toEqual(['open-story:tour:start']);
  });

  it('offers a story already read from where it was left, or again from the start', () => {
    const div = parse(
      storiesHtml([card({ place: { number: 7, total: 21, label: "Abraham's call" } })]),
    );
    expect(div.textContent).toContain('7 of 21');
    expect(div.textContent).toContain("Abraham's call");
    expect(actions(div)).toEqual(['open-story:tour:place', 'open-story:tour:start']);
  });

  it('tags a draft', () => {
    expect(
      parse(storiesHtml([card({ draft: true })])).querySelector('.story-draft'),
    ).not.toBeNull();
    expect(parse(storiesHtml([card({})])).querySelector('.story-draft')).toBeNull();
  });

  it('escapes what the story file says', () => {
    const div = parse(
      storiesHtml([
        card({
          title: '<img src=x>',
          description: '<img src=y>',
          place: { number: 1, total: 1, label: '<img src=z>' },
        }),
      ]),
    );
    expect(div.querySelector('img')).toBeNull();
  });
});

describe('storyChosen', () => {
  const buttons = (html: string): HTMLElement[] => [
    ...parse(html).querySelectorAll<HTMLElement>('button'),
  ];

  it("reads a card's Read as its story from the start", () => {
    const [read] = buttons(storiesHtml([card({ id: 'job' })]));
    expect(storyChosen(read)).toEqual({ id: 'job', fromStart: true });
  });

  it("reads a card's Continue and Start from the beginning", () => {
    const [cont, restart] = buttons(
      storiesHtml([card({ place: { number: 2, total: 4, label: 'x' } })]),
    );
    expect(storyChosen(cont)).toEqual({ id: 'tour', fromStart: false });
    expect(storyChosen(restart)).toEqual({ id: 'tour', fromStart: true });
  });

  it('reads nothing from an element outside a card', () => {
    expect(storyChosen(document.createElement('button'))).toBeNull();
  });
});
