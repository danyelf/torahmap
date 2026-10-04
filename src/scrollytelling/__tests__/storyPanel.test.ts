import { describe, it, expect } from 'vitest';
import { renderStoryPanel, resolveStops, stopLabel } from '../storyPanel';
import { initBookData } from '../../constants/books';
import { cameraToFit } from '../../camera';
import { SECTION_LABEL_REACH } from '../../labels';
import type { TanakhLayout } from '../../types';
import { createVerse } from '../../__tests__/helpers/fixtures';
import type { StoryStop } from '@torahmap/stories';

function stop(fields: Partial<StoryStop> = {}): StoryStop {
  return { id: 's', text: 'Text.', camera: 'initial', overlay: null, ...fields };
}

describe('renderStoryPanel', () => {
  it('shows a heading for a titled stop', () => {
    const [el] = renderStoryPanel(document.createElement('div'), [stop({ title: 'Abraham' })]);
    expect(el.querySelector('h2')?.textContent).toBe('Abraham');
  });

  it('shows no heading for an untitled stop', () => {
    const [el] = renderStoryPanel(document.createElement('div'), [stop()]);
    expect(el.querySelector('h2')).toBeNull();
    expect(el.querySelector('.story-text')?.textContent).toBe('Text.');
  });
});

describe('stopLabel', () => {
  it('is the title when the stop has one', () => {
    expect(stopLabel(stop({ title: 'The Rename', text: 'Five chapters later.' }))).toBe(
      'The Rename',
    );
  });

  it('is the first sentence when the stop has no title', () => {
    expect(stopLabel(stop({ text: 'Five chapters later. God renames him.' }))).toBe(
      'Five chapters later.',
    );
  });
});

describe('resolveStops with a pinned verse', () => {
  const verses = [1, 2, 3].map((verse) => createVerse({ verse, x: verse * 10 }));
  const initial = { x: 1, y: 2, zoom: 3 };
  const resolve = (fields: Partial<StoryStop>) =>
    resolveStops([stop(fields)], initial, verses, { x: 0, y: 0 }, { width: 400, height: 300 })[0]
      .camera;

  it('moves the camera to a verse the map holds', () => {
    expect(resolve({ verse: verses[1].id })).not.toEqual(initial);
  });

  it('keeps the initial camera for a verse the map does not hold', () => {
    expect(resolve({ verse: 'Genesis.99.1' })).toEqual(initial);
  });
});

describe('resolveStops with a region camera', () => {
  initBookData({
    books: [
      { name: 'Genesis', hebrewName: '', section: 'torah', chapters: [1] },
      { name: 'I Samuel', hebrewName: '', section: 'neviim', chapters: [1] },
      { name: 'Psalms', hebrewName: '', section: 'ketuvim', chapters: [1] },
    ],
    layout: { minorProphetStacks: [], ketuvimStacks: [], multiColumnBooks: {} },
  });
  const verse = (book: string, x: number, y: number): TanakhLayout =>
    createVerse({ book, x, y, size: 10 });
  const verses = [verse('Genesis', 0, 0), verse('I Samuel', 90, 100), verse('Psalms', 190, 200)];
  const initial = { x: 1, y: 2, zoom: 3 };
  const map = { width: 400, height: 300 };
  const resolve = (fields: Partial<StoryStop>) =>
    resolveStops([stop(fields)], initial, verses, { x: 0, y: 0 }, map)[0].camera;

  it('fits a book', () => {
    const box = { minX: 90, minY: 100, maxX: 100 + SECTION_LABEL_REACH, maxY: 110 };
    expect(resolve({ camera: { kind: 'regions', names: ['I.Samuel'] } })).toEqual(
      cameraToFit(box, 400, 300),
    );
  });

  it('fits several regions together', () => {
    const box = { minX: 90, minY: 100, maxX: 200 + SECTION_LABEL_REACH, maxY: 210 };
    expect(resolve({ camera: { kind: 'regions', names: ['Neviim', 'Ketuvim'] } })).toEqual(
      cameraToFit(box, 400, 300),
    );
  });

  it('fits everything, at a given zoom', () => {
    const box = { minX: 0, minY: 0, maxX: 200 + SECTION_LABEL_REACH, maxY: 210 };
    expect(resolve({ camera: { kind: 'regions', names: ['everything'] }, zoom: 0.5 })).toEqual(
      cameraToFit(box, 400, 300, 0.5),
    );
  });

  it('uses the initial camera when no region is found', () => {
    expect(resolve({ camera: { kind: 'regions', names: ['Nowhere'] } })).toEqual(initial);
  });
});
