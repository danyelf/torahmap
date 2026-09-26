import { describe, it, expect } from 'vitest';
import { DRAG_PX, STORY, exploreFrame, isPanel, nextFrame, type Frame } from '../../frame';

const explore = (open: Frame['open'], full = false): Frame => ({
  mode: 'explore',
  open,
  menu: false,
  full,
});
const PHONE = true;
const DESKTOP = false;

describe('the story', () => {
  it('drops its menu on ☰ and lifts it on ☰ again', () => {
    const down = nextFrame(STORY, { type: 'menu' }, DESKTOP);
    expect(down).toEqual({ ...STORY, menu: true });
    expect(nextFrame(down, { type: 'menu' }, DESKTOP)).toEqual(STORY);
    expect(nextFrame(STORY, { type: 'menu' }, PHONE)).toEqual(down);
  });

  it('lifts its menu when the map is touched', () => {
    const down = { ...STORY, menu: true };
    expect(nextFrame(down, { type: 'map-touched' }, PHONE)).toEqual(STORY);
    expect(nextFrame(down, { type: 'map-touched' }, DESKTOP)).toEqual(STORY);
  });

  it('ends when a panel is chosen, opening that panel', () => {
    const down = { ...STORY, menu: true };
    expect(nextFrame(down, { type: 'choose', panel: 'about' }, DESKTOP)).toEqual(explore('about'));
  });

  it('keeps a constant height: a drag does nothing', () => {
    expect(nextFrame(STORY, { type: 'drag', dy: -100 }, PHONE)).toEqual(STORY);
  });
});

describe('returning to the story', () => {
  it('comes from any panel', () => {
    expect(nextFrame(explore('about', true), { type: 'story' }, PHONE)).toEqual(STORY);
  });
});

describe('exploring on a desktop', () => {
  it('always has a panel open', () => {
    expect(exploreFrame(DESKTOP)).toEqual(explore('overlay'));
    expect(nextFrame(explore('stories'), { type: 'map-touched' }, DESKTOP)).toEqual(
      explore('stories'),
    );
  });

  it('keeps a panel open when its rail icon is clicked again', () => {
    expect(nextFrame(explore('about'), { type: 'choose', panel: 'about' }, DESKTOP)).toEqual(
      explore('about'),
    );
  });

  it('closes the menu panel back to the overlay on ☰', () => {
    expect(nextFrame(explore('menu'), { type: 'menu' }, DESKTOP)).toEqual(explore('overlay'));
  });

  it('never goes full height', () => {
    expect(nextFrame(explore('overlay'), { type: 'typing' }, DESKTOP)).toEqual(explore('overlay'));
  });
});

describe('exploring on a phone', () => {
  it('opens a link with nothing open', () => {
    expect(exploreFrame(PHONE)).toEqual(explore(null));
  });

  it('folds everything when the map is touched', () => {
    expect(nextFrame(explore('overlay', true), { type: 'map-touched' }, PHONE)).toEqual(
      explore(null),
    );
  });

  it('folds a panel whose legend row is tapped again', () => {
    expect(nextFrame(explore('overlay'), { type: 'choose', panel: 'overlay' }, PHONE)).toEqual(
      explore(null),
    );
  });

  it('drops the menu from the corner on ☰, leaving the sheet as it is', () => {
    const down = nextFrame(explore('overlay'), { type: 'menu' }, PHONE);
    expect(down).toEqual({ ...explore('overlay'), menu: true });
    expect(nextFrame(down, { type: 'menu' }, PHONE)).toEqual(explore('overlay'));
  });

  it('lifts the menu when one of its panels is chosen', () => {
    const down = { ...explore(null), menu: true };
    expect(nextFrame(down, { type: 'choose', panel: 'stories' }, PHONE)).toEqual(
      explore('stories'),
    );
  });

  it('goes full height on a drag up, then back, then folds', () => {
    const full = nextFrame(explore('overlay'), { type: 'drag', dy: -40 }, PHONE);
    expect(full).toEqual(explore('overlay', true));
    const fitted = nextFrame(full, { type: 'drag', dy: 40 }, PHONE);
    expect(fitted).toEqual(explore('overlay'));
    expect(nextFrame(fitted, { type: 'drag', dy: 40 }, PHONE)).toEqual(explore(null));
  });

  it('treats a movement under DRAG_PX as no drag', () => {
    const f = explore('overlay');
    expect(nextFrame(f, { type: 'drag', dy: -(DRAG_PX - 1) }, PHONE)).toEqual(f);
  });

  it('cannot drag a sheet with nothing open', () => {
    expect(nextFrame(explore(null), { type: 'drag', dy: -40 }, PHONE)).toEqual(explore(null));
  });

  it('goes full height for typing', () => {
    expect(nextFrame(explore('overlay'), { type: 'typing' }, PHONE)).toEqual(
      explore('overlay', true),
    );
  });
});

describe('crossing from desktop width to phone width', () => {
  it('drops the menu from the corner rather than keeping it in a panel', () => {
    expect(nextFrame(explore('menu'), { type: 'layout-changed' }, PHONE)).toEqual({
      ...explore(null),
      menu: true,
    });
  });
});

describe('crossing from phone width to desktop width', () => {
  it('opens the overlay if nothing was open, and drops full height', () => {
    expect(nextFrame(explore(null), { type: 'layout-changed' }, DESKTOP)).toEqual(
      explore('overlay'),
    );
    expect(nextFrame(explore('about', true), { type: 'layout-changed' }, DESKTOP)).toEqual(
      explore('about'),
    );
  });

  it("lifts a phone's dropped menu, which a desktop keeps in a panel", () => {
    expect(
      nextFrame({ ...explore(null), menu: true }, { type: 'layout-changed' }, DESKTOP),
    ).toEqual(explore('overlay'));
  });
});

describe('panel names', () => {
  it('accepts the panels and nothing else', () => {
    expect(['overlay', 'stories', 'about', 'menu'].every(isPanel)).toBe(true);
    expect(isPanel('story')).toBe(false);
    expect(isPanel('restart')).toBe(false);
    expect(isPanel(undefined)).toBe(false);
  });
});
