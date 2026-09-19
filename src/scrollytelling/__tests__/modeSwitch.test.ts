import { describe, expect, it } from 'vitest';
import { stopForModeChange, stopNumber } from '../modeSwitch';

const stops = [{ id: 'intro' }, { id: 'creation' }, { id: 'flood' }];

describe('stopForModeChange', () => {
  it('names the last stop reached when leaving the story', () => {
    expect(stopForModeChange(stops, 'explore', 'flood', null)).toBe(stops[2]);
  });

  it('names the stop the story resumes at when returning', () => {
    expect(stopForModeChange(stops, 'story', 'flood', 'creation')).toBe(stops[1]);
  });

  it('names the first stop when no stop is known', () => {
    expect(stopForModeChange(stops, 'explore', '', null)).toBe(stops[0]);
    expect(stopForModeChange(stops, 'story', 'flood', null)).toBe(stops[0]);
    expect(stopForModeChange(stops, 'story', '', 'gone')).toBe(stops[0]);
  });

  it('names nothing in a story with no stops', () => {
    expect(stopForModeChange([], 'explore', 'flood', null)).toBeUndefined();
  });
});

describe('stopNumber', () => {
  it('counts from one, and is zero for a stop not in the story', () => {
    expect(stopNumber(stops, 'intro')).toBe(1);
    expect(stopNumber(stops, 'flood')).toBe(3);
    expect(stopNumber(stops, 'gone')).toBe(0);
  });
});
