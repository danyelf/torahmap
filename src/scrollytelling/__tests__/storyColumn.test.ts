// The story column, laid out as on a phone: one stop per page, side by side,
// each page as wide as the column. Which stop shows is read from the scroll.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Story, StoryStop } from '@torahmap/stories';
import { createStoryColumn, placeIn, type StoryColumn } from '../storyColumn';

const PAGE = 100;

function story(id: string, stops: string[]): Story {
  return {
    id,
    data: {
      title: id,
      description: '',
      draft: false,
      stops: stops.map((stop): StoryStop => ({
        id: stop,
        text: stop,
        camera: 'initial',
        overlay: null,
      })),
    },
  } as Story;
}

const STORIES = [story('torah', ['t1', 't2', 't3']), story('psalms', ['p1', 'p2'])];

let content: HTMLElement;
let column: StoryColumn;
let progress: HTMLElement;

/** The reader swipes to page `index`. */
function swipeTo(index: number): void {
  content.scrollLeft = index * PAGE;
  content.dispatchEvent(new Event('scroll'));
}

beforeEach(() => {
  content = document.createElement('div');
  // Laid out as on a phone, as phone.css says with --layout.
  document.documentElement.style.setProperty('--layout', 'phone');
  Object.defineProperty(content, 'clientWidth', { value: PAGE });
  document.body.append(content);
  progress = document.createElement('div');
  // A stop brought into view puts its page in the column.
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(function (
    this: HTMLElement,
  ) {
    content.scrollLeft = [...content.children].indexOf(this) * PAGE;
  });
  column = createStoryColumn(
    { content, progress, title: document.createElement('div') },
    STORIES,
    null,
    (stops) => stops.map((stop) => ({ ...stop, camera: { x: 0, y: 0, zoom: 1 } })),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  content.remove();
  document.documentElement.style.removeProperty('--layout');
});

describe('the story column', () => {
  it('opens at the stop asked for, and says the story is there', () => {
    const opened = column.open(undefined, 't2');
    expect(opened.stop.id).toBe('t2');
    expect(column.where().stop.id).toBe('t2');
    expect(column.view().fromStop.id).toBe('t2');
  });

  it('opens a story at its start for a stop it does not have', () => {
    expect(column.open('torah', 'nowhere').stop.id).toBe('t1');
  });

  it('holds its stop while folded, and opens there again', () => {
    column.open(undefined, 't3');
    column.fold();
    // Hidden, the column loses its scroll.
    content.scrollLeft = 0;
    expect(column.where().stop.id).toBe('t3');
    expect(column.open().stop.id).toBe('t3');
  });

  it('remembers where a story was left when another opens', () => {
    column.open('torah', 't2');
    column.open('psalms');
    expect(column.where().story.id).toBe('psalms');
    expect(column.where().stop.id).toBe('p1');
    expect(column.leftAt('torah')).toBe(1);
    expect(column.open('torah').stop.id).toBe('t2');
  });

  it('says when the reader swipes to another stop, and is there', () => {
    let moves = 0;
    column.onMove(() => moves++);
    swipeTo(1);
    expect(moves).toBe(1);
    expect(column.where().stop.id).toBe('t2');
  });

  it('counts the stops of a story edited on the dev server', () => {
    column.storiesChanged([story('torah', ['t1', 't2', 't3', 't4']), STORIES[1]]);
    expect(progress.getAttribute('aria-valuemax')).toBe('4');
  });

  it('says nothing of a scroll while folded', () => {
    let moves = 0;
    column.onMove(() => moves++);
    column.fold();
    swipeTo(2);
    expect(moves).toBe(0);
  });
});

describe("a stop's place", () => {
  const stops = [{ id: 'intro' }, { id: 'creation' }, { id: 'flood' }];

  it('counts from one, out of every stop', () => {
    expect(placeIn(stops, 0)).toEqual({ number: 1, total: 3 });
    expect(placeIn(stops, 2)).toEqual({ number: 3, total: 3 });
  });

  it('is zero for a place not in the story', () => {
    expect(placeIn(stops, -1)).toEqual({ number: 0, total: 3 });
    expect(placeIn(stops, 3)).toEqual({ number: 0, total: 3 });
  });
});
