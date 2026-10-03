import { describe, it, expect } from 'vitest';
import {
  DRAG_PX,
  STORY,
  exploreFrame,
  frontToolAfter,
  isPanel,
  landingFrame,
  nextFrame,
  type Frame,
} from '../../frame';

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

describe('arriving at the explore view', () => {
  it('opens the overlay panel on a map that shows nothing, on a phone too', () => {
    const blank = { overlay: false, search: false };
    expect(landingFrame(DESKTOP, blank)).toEqual(explore('overlay'));
    expect(landingFrame(PHONE, blank)).toEqual(explore('overlay'));
  });

  it("otherwise opens the shown tool's panel, and on a phone none", () => {
    expect(landingFrame(DESKTOP, { overlay: true, search: false })).toEqual(explore('overlay'));
    expect(landingFrame(DESKTOP, { overlay: true, search: true })).toEqual(explore('search'));
    expect(landingFrame(PHONE, { overlay: false, search: true })).toEqual(explore(null));
  });
});

describe('exploring on a desktop', () => {
  it('lands on the panel a link asks for, on a desktop', () => {
    expect(exploreFrame(DESKTOP, 'search')).toEqual(explore('search'));
    expect(exploreFrame(PHONE, 'search')).toEqual(explore(null));
  });

  it('opens on the overlay and keeps its panel when the map is touched', () => {
    expect(exploreFrame(DESKTOP)).toEqual(explore('overlay'));
    expect(nextFrame(explore('stories'), { type: 'map-touched' }, DESKTOP)).toEqual(
      explore('stories'),
    );
  });

  it('closes its panel, and opens one again from the menu', () => {
    const closed = nextFrame(explore('search'), { type: 'close' }, DESKTOP);
    expect(closed).toEqual(explore(null));
    expect(nextFrame(closed, { type: 'map-touched' }, DESKTOP)).toEqual(closed);
    const down = nextFrame(closed, { type: 'menu' }, DESKTOP);
    expect(nextFrame(down, { type: 'choose', panel: 'overlay' }, DESKTOP)).toEqual(
      explore('overlay'),
    );
  });

  it('folds a story on close, giving the map the whole window', () => {
    expect(nextFrame(STORY, { type: 'close' }, DESKTOP)).toEqual(explore(null));
  });

  it("leaves a phone's story alone on close", () => {
    expect(nextFrame(STORY, { type: 'close' }, PHONE)).toEqual(STORY);
  });

  it('keeps a panel open when it is chosen again', () => {
    expect(nextFrame(explore('about'), { type: 'choose', panel: 'about' }, DESKTOP)).toEqual(
      explore('about'),
    );
  });

  it('drops the menu over the open panel on ☰, and lifts it on ☰ or a touch on the map', () => {
    const down = nextFrame(explore('about'), { type: 'menu' }, DESKTOP);
    expect(down).toEqual({ ...explore('about'), menu: true });
    expect(nextFrame(down, { type: 'menu' }, DESKTOP)).toEqual(explore('about'));
    expect(nextFrame(down, { type: 'map-touched' }, DESKTOP)).toEqual(explore('about'));
  });

  it('opens the panel chosen from the menu', () => {
    const down = { ...explore('overlay'), menu: true };
    expect(nextFrame(down, { type: 'choose', panel: 'stories' }, DESKTOP)).toEqual(
      explore('stories'),
    );
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

  it('keeps the open panel open when the menu chooses it again', () => {
    const down = { ...explore('overlay'), menu: true };
    expect(nextFrame(down, { type: 'choose', panel: 'overlay' }, PHONE)).toEqual(
      explore('overlay'),
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

describe('crossing from phone width to desktop width', () => {
  it('keeps a closed panel closed, and drops full height', () => {
    expect(nextFrame(explore(null), { type: 'layout-changed' }, DESKTOP)).toEqual(explore(null));
    expect(nextFrame(explore('about', true), { type: 'layout-changed' }, DESKTOP)).toEqual(
      explore('about'),
    );
  });
});

describe('which tool leads', () => {
  it('switches to the panel that opens', () => {
    expect(frontToolAfter('overlay', 'search')).toBe('search');
    expect(frontToolAfter('search', 'overlay')).toBe('overlay');
  });

  it('keeps the current tool when Stories, About, or nothing opens', () => {
    expect(frontToolAfter('search', 'stories')).toBe('search');
    expect(frontToolAfter('overlay', 'about')).toBe('overlay');
    expect(frontToolAfter('search', null)).toBe('search');
  });
});

describe('panel names', () => {
  it('accepts the panels and nothing else', () => {
    expect(['search', 'overlay', 'stories', 'about'].every(isPanel)).toBe(true);
    expect(isPanel('menu')).toBe(false);
    expect(isPanel('story')).toBe(false);
    expect(isPanel('restart')).toBe(false);
    expect(isPanel(undefined)).toBe(false);
  });
});
