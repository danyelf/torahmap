import { describe, it, expect } from 'vitest';
import {
  REJOIN_SCROLL_PX,
  REJOIN_EASE_MS,
  SWIPE_EASE_MS,
  STORY_DRIVING,
  colorSource,
  DRIVER_KINDS,
  driverKind,
  readerTakesOver,
  storyScrolled,
  rejoin,
  rejoinProgress,
  settle,
  type Driver,
} from '../driver';
import type { ResolvedStoryStop } from '../types';

const camera = { x: 1, y: 2, zoom: 3 };
const easeBack = (now: number, duration = REJOIN_EASE_MS): Driver =>
  rejoin(now, duration, camera, [], []);

describe('the story drives until the reader takes over', () => {
  it('keeps the reader driving through a nudge', () => {
    const driver = storyScrolled(readerTakesOver(1000), 1020);
    if (driver === 'rejoin') throw new Error('handed back too soon');

    expect(storyScrolled(driver, 1045)).toEqual({
      by: 'reader',
      lastScrollTop: 1045,
      travelled: 45,
    });
  });

  it('hands back once the reader has scrolled the threshold', () => {
    expect(storyScrolled(readerTakesOver(1000), 1000 + REJOIN_SCROLL_PX)).toBe('rejoin');
  });

  it('measures distance, so many small scrolls count the same as one large one', () => {
    let small: ReturnType<typeof storyScrolled> = readerTakesOver(0);
    for (let top = 5; top <= REJOIN_SCROLL_PX && small !== 'rejoin'; top += 5) {
      small = storyScrolled(small, top);
    }

    expect(small).toBe('rejoin');
  });

  it('counts scrolling back up as distance too', () => {
    const driver = storyScrolled(readerTakesOver(1000), 1000 - REJOIN_SCROLL_PX / 2);
    if (driver === 'rejoin') throw new Error('handed back too soon');

    expect(storyScrolled(driver, 1000)).toBe('rejoin');
  });
});

describe('easing back', () => {
  it('runs from 0 to 1 over the ease-back time', () => {
    const driver = easeBack(1000);

    expect(rejoinProgress(driver, 1000)).toBe(0);
    expect(rejoinProgress(driver, 1000 + REJOIN_EASE_MS / 2)).toBeCloseTo(0.5);
    expect(rejoinProgress(driver, 1000 + REJOIN_EASE_MS * 2)).toBe(1);
  });

  it('hands the map back to the story when it finishes', () => {
    const driver = easeBack(0);

    expect(settle(driver, REJOIN_EASE_MS - 1).by).toBe('rejoining');
    expect(settle(driver, REJOIN_EASE_MS)).toEqual(STORY_DRIVING);
  });

  it('leaves the reader alone', () => {
    const driver = readerTakesOver(0);

    expect(settle(driver, 10_000)).toBe(driver);
  });

  it('can take its own time, as a phone swipe does', () => {
    const driver = easeBack(0, SWIPE_EASE_MS);

    expect(rejoinProgress(driver, SWIPE_EASE_MS / 2)).toBeCloseTo(0.5);
    expect(settle(driver, REJOIN_EASE_MS).by).toBe('rejoining');
    expect(settle(driver, SWIPE_EASE_MS)).toEqual(STORY_DRIVING);
  });

  it('keeps its own copy of the camera it starts from', () => {
    const moving = { ...camera };
    const driver = rejoin(0, REJOIN_EASE_MS, moving, [], []);
    moving.x = 99;

    expect(driver.by === 'rejoining' && driver.fromCamera).toEqual(camera);
  });
});

describe('what the colours on the map are drawn from', () => {
  const stop = { id: 'a' } as ResolvedStoryStop;

  it('is the overlay when the reader drives or the story rests on a stop', () => {
    expect(colorSource(readerTakesOver(0))).toBe('overlay');
    expect(colorSource(STORY_DRIVING)).toBe('overlay');
  });

  it('is a blend while the story scrolls between stops', () => {
    expect(colorSource({ by: 'story', blend: { from: stop, to: stop, t: 0.5 } })).toBe('blend');
  });

  it('is the ease while the map eases', () => {
    expect(colorSource(easeBack(0))).toBe('ease');
  });
});

describe('who has the map', () => {
  it('is the story while it drives or eases back, the reader while they drive', () => {
    expect(driverKind(STORY_DRIVING)).toBe('story');
    expect(driverKind(easeBack(0))).toBe('story');
    expect(driverKind(readerTakesOver(0))).toBe('reader');
    expect(DRIVER_KINDS).toEqual(['story', 'reader']);
  });
});
