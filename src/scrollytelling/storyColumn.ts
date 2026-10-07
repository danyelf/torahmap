// The story in the left column (a strip along the bottom on a phone): which
// story is open, where the reader is in it, and what the map would show there.
// It never touches the map; the shell asks it for its view and shows that.

import { storyToOpen, type Story, type StoryStop } from '@torahmap/stories';
import type { StoryPlace } from '../menu.ts';
import { isPhone } from '../phone.ts';
import { computeInterpolatedState } from './controller';
import { renderStoryPanel } from './storyPanel';
import type { InterpolatedState, ResolvedStoryStop } from './types';

export interface StoryColumn {
  /** What the story shows where the reader has scrolled: `fromStop` and `toStop` are the same stop at rest. */
  view(): InterpolatedState;
  /** The reader moved the story. */
  onMove(listener: () => void): void;
  /** The story open and the stop the reader is at, for the URL and the menu. */
  where(): { story: Story; stop: ResolvedStoryStop; place: StoryPlace };
  /** The stop a story was left at this visit, or undefined if it has not been opened. */
  leftAt(id: string): number | undefined;
  /**
   * Show the column at a stop, and say which. `storyId` undefined keeps the
   * story open, null opens the first listed; `stop` undefined goes to where the
   * story was left this visit, and null, or an id it does not have, to its start.
   */
  open(
    storyId?: string | null,
    stop?: string | null,
  ): { stop: ResolvedStoryStop; place: StoryPlace };
  /** Hide the column, holding the stop it is at: hidden, it has no height to scroll. */
  fold(): void;
  /** How far along the column is scrolled, for the rule that hands the map back to the story. */
  position(): number;
  /** The map's size or the page's layout changed: place the stops again, keeping the reader's. */
  resized(): void;
  /** The stories changed, as they do when one is edited on the dev server. */
  storiesChanged(list: readonly Story[]): void;
}

export interface StoryColumnParts {
  content: HTMLElement;
  progress: HTMLElement;
  title: HTMLElement;
}

/** The place of the stop at `index` among `stops`, counted from one. */
export function placeIn(stops: readonly { id: string }[], index: number): StoryPlace {
  return { number: stops[index] ? index + 1 : 0, total: stops.length };
}

/** The stop a story between two stops counts as at: the one it is more than halfway to. */
export function nearerStop(state: InterpolatedState): ResolvedStoryStop {
  return state.t > 0.5 ? state.toStop : state.fromStop;
}

export function createStoryColumn(
  parts: StoryColumnParts,
  stories: readonly Story[],
  first: string | null,
  resolve: (stops: StoryStop[]) => ResolvedStoryStop[],
): StoryColumn {
  const { content, progress, title } = parts;
  let listed = stories;
  let story = named(first);
  let stops: ResolvedStoryStop[] = [];
  let elements: HTMLElement[] = [];
  // Where each story other than the open one was left, this visit.
  const places = new Map<string, number>();
  // The stop held while the column is folded or being brought to a stop. Null
  // while its scroll says where it is.
  let held: number | null = null;
  // The stop the reader was last at, and the axis the stops were laid on, to
  // keep the reader's stop when a phone and a desktop layout swap.
  let current = 0;
  let wasSideways = false;
  const listeners: (() => void)[] = [];

  function named(id: string | null): Story {
    const found = storyToOpen(listed, id);
    if (!found) throw new Error('No story is listed');
    return found;
  }

  function load(next: Story): void {
    story = next;
    title.textContent = story.data.title;
    title.dataset.title = story.data.title;
    stops = resolve(story.data.stops);
    elements = renderStoryPanel(content, story.data.stops);
  }

  // On a phone the stops sit side by side and a swipe moves one; elsewhere
  // they stack and scroll.
  const sideways = isPhone;

  const position = (): number => (sideways() ? content.scrollLeft : content.scrollTop);

  function setPosition(at: number): void {
    if (sideways()) content.scrollLeft = at;
    else content.scrollTop = at;
  }

  const pageShown = (): number =>
    Math.min(
      stops.length - 1,
      Math.max(0, Math.round(content.scrollLeft / Math.max(1, content.clientWidth))),
    );

  function view(): InterpolatedState {
    // On a phone the story is at whichever page is showing. Moving between
    // pages is eased on a timer by the shell, not tracked through the swipe.
    if (sideways()) {
      const stop = stops[pageShown()];
      return { camera: { ...stop.camera }, fromStop: stop, toStop: stop, t: 0 };
    }
    return computeInterpolatedState(
      stops,
      elements.map((el) => el.offsetTop),
      content.scrollHeight,
      content.scrollTop,
      story.data.easing,
      elements.map((el) => el.offsetHeight),
      content.clientHeight,
    );
  }

  const stopIndex = (): number => held ?? stops.indexOf(nearerStop(view()));

  function show(index: number): void {
    // Centred, where the story holds a stop still; top-aligned, a stop shorter
    // than the story settles partway into the next.
    elements[index]?.scrollIntoView(
      sideways() ? { block: 'nearest', inline: 'center' } : { block: 'center' },
    );
  }

  function arrived(): void {
    const state = view();
    current = stops.indexOf(nearerStop(state));
    const { number, total } = placeIn(stops, current);
    progress.style.setProperty('--progress', `${(number / total) * 100}%`);
    progress.setAttribute('aria-valuenow', String(number));
    progress.setAttribute('aria-valuemax', String(total));
    // Nothing further to scroll to, so no cue to.
    document.body.classList.toggle('story-at-end', state.toStop === stops[stops.length - 1]);
  }

  content.addEventListener('scroll', () => {
    if (held !== null) return;
    arrived();
    for (const listener of listeners) listener();
  });

  load(story);
  wasSideways = sideways();
  arrived();

  return {
    view,
    onMove: (listener) => listeners.push(listener),
    where: () => ({ story, stop: stops[stopIndex()], place: placeIn(stops, stopIndex()) }),
    leftAt: (id) => (id === story.id ? stopIndex() : places.get(id)),

    open(storyId, stop) {
      let index = held ?? stopIndex();
      if (storyId !== undefined) {
        const next = named(storyId);
        if (next.id !== story.id) {
          places.set(story.id, stopIndex());
          index = places.get(next.id) ?? 0;
          places.delete(next.id);
          load(next);
        }
      }
      held = index;
      // A stop's camera is placed against the map as the story shows it, so the
      // stops are resolved once the column is showing.
      stops = resolve(story.data.stops);
      if (stop !== undefined)
        held = Math.max(
          0,
          stops.findIndex((s) => s.id === stop),
        );
      const opened = { stop: stops[held], place: placeIn(stops, held) };
      show(held);
      held = null;
      arrived();
      return opened;
    },

    fold() {
      held = stopIndex();
    },

    position,

    resized() {
      stops = resolve(story.data.stops);
      const relaid = sideways() !== wasSideways;
      wasSideways = sideways();
      if (held !== null || !relaid) return;
      show(current);
    },

    storiesChanged(list) {
      listed = list;
      const at = position();
      load(named(story.id));
      setPosition(at);
    },
  };
}
