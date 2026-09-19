import { describe, expect, it } from 'vitest';
import { STORY_DRIVING, readerTakesOver, rejoin } from '../../../scrollytelling/driver.ts';
import { driverChangeEvent, stopAt } from '../../../telemetry/driverChange.ts';

const reader = readerTakesOver(0);
const easing = rejoin(0, 700, { x: 0, y: 0, zoom: 1 }, [], []);

describe('driverChangeEvent', () => {
  it('is story_exit when the reader takes the map from the story', () => {
    expect(driverChangeEvent(STORY_DRIVING, reader)).toBe('story_exit');
    expect(driverChangeEvent(easing, reader)).toBe('story_exit');
  });

  it('is story_return when the story takes the map back, cut or eased', () => {
    expect(driverChangeEvent(reader, STORY_DRIVING)).toBe('story_return');
    expect(driverChangeEvent(reader, easing)).toBe('story_return');
  });

  it('is nothing while the same one keeps the map', () => {
    expect(driverChangeEvent(easing, STORY_DRIVING)).toBeNull();
    expect(driverChangeEvent(STORY_DRIVING, easing)).toBeNull();
    expect(driverChangeEvent(STORY_DRIVING, STORY_DRIVING)).toBeNull();
    expect(driverChangeEvent(reader, readerTakesOver(40))).toBeNull();
  });
});

describe('stopAt', () => {
  const stops = [{ id: 'intro' }, { id: 'creation' }, { id: 'flood' }];

  it('names the stop and counts from one', () => {
    expect(stopAt(stops, 0)).toEqual({ id: 'intro', number: 1 });
    expect(stopAt(stops, 2)).toEqual({ id: 'flood', number: 3 });
  });

  it('is empty and zero for a place not in the story', () => {
    expect(stopAt(stops, -1)).toEqual({ id: '', number: 0 });
    expect(stopAt(stops, 3)).toEqual({ id: '', number: 0 });
  });
});
