import { describe, it, expect } from 'vitest';
import {
  REJOIN_SCROLL_PX,
  REJOIN_EASE_MS,
  SWIPE_EASE_MS,
  STORY_DRIVING,
  readerTakesOver,
  storyScrolled,
  rejoinNow,
  rejoinProgress,
  settle,
  readerAsStop,
} from '../driver';

describe('the story drives until the reader takes over', () => {
  it('ignores scrolling while the story is already driving', () => {
    expect(storyScrolled(STORY_DRIVING, 500, 0)).toBe(STORY_DRIVING);
  });

  it('keeps the reader driving through a nudge', () => {
    let driver = readerTakesOver(1000);
    driver = storyScrolled(driver, 1020, 0);
    driver = storyScrolled(driver, 1045, 0);

    expect(driver.by).toBe('reader');
  });

  it('hands back once the reader has scrolled the threshold', () => {
    let driver = readerTakesOver(1000);
    driver = storyScrolled(driver, 1000 + REJOIN_SCROLL_PX, 42);

    expect(driver).toEqual({ by: 'rejoining', since: 42, duration: REJOIN_EASE_MS });
  });

  it('measures distance, so many small scrolls count the same as one large one', () => {
    let small = readerTakesOver(0);
    for (let top = 5; top <= REJOIN_SCROLL_PX; top += 5) small = storyScrolled(small, top, 0);

    const large = storyScrolled(readerTakesOver(0), REJOIN_SCROLL_PX, 0);

    expect(small.by).toBe('rejoining');
    expect(large.by).toBe('rejoining');
  });

  it('counts scrolling back up as distance too', () => {
    let driver = readerTakesOver(1000);
    driver = storyScrolled(driver, 1000 - REJOIN_SCROLL_PX / 2, 0);
    driver = storyScrolled(driver, 1000, 0);

    expect(driver.by).toBe('rejoining');
  });

  it('lets the reader take over again in the middle of an ease-back', () => {
    const driver = readerTakesOver(700);

    expect(driver).toEqual({ by: 'reader', lastScrollTop: 700, travelled: 0 });
  });
});

describe('easing back', () => {
  it('runs from 0 to 1 over the ease-back time', () => {
    const driver = rejoinNow(1000);

    expect(rejoinProgress(driver, 1000)).toBe(0);
    expect(rejoinProgress(driver, 1000 + REJOIN_EASE_MS / 2)).toBeCloseTo(0.5);
    expect(rejoinProgress(driver, 1000 + REJOIN_EASE_MS * 2)).toBe(1);
  });

  it('hands the map back to the story when it finishes', () => {
    const driver = rejoinNow(0);

    expect(settle(driver, REJOIN_EASE_MS - 1).by).toBe('rejoining');
    expect(settle(driver, REJOIN_EASE_MS)).toEqual(STORY_DRIVING);
  });

  it('leaves the reader alone', () => {
    const driver = readerTakesOver(0);

    expect(settle(driver, 10_000)).toBe(driver);
  });

  it('can take its own time, as a phone swipe does', () => {
    const driver = rejoinNow(0, SWIPE_EASE_MS);

    expect(rejoinProgress(driver, SWIPE_EASE_MS / 2)).toBeCloseTo(0.5);
    expect(settle(driver, REJOIN_EASE_MS).by).toBe('rejoining');
    expect(settle(driver, SWIPE_EASE_MS)).toEqual(STORY_DRIVING);
  });
});

describe('readerAsStop', () => {
  it('describes what the reader has on screen the way a story stop would', () => {
    const stop = readerAsStop({ x: 1, y: 2, zoom: 3 }, 'search', { q: 'אברם' });

    expect(stop.camera).toEqual({ x: 1, y: 2, zoom: 3 });
    expect(stop.overlay).toBe('search');
    expect(stop.overlayParams).toEqual({ q: 'אברם' });
  });

  it('treats no overlay as no overlay', () => {
    expect(readerAsStop({ x: 0, y: 0, zoom: 1 }, 'none', {}).overlay).toBeNull();
  });
});
