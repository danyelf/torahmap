import { cameraToFit, centreForFocus, indexItems } from '@torahmap/engine';
import { describe, it, expect } from 'vitest';
import { resolveStops } from '../../tanakh/stories';
import { initBookData } from '../../constants/books';
import { SECTION_LABEL_REACH } from '../../labels';
import type { TanakhLayout } from '../../types';
import { createStoryStop as stop, createVerse, ZOOM } from '../helpers/fixtures';
import type { StoryStop } from '@torahmap/stories';

describe('resolveStops with a pinned verse', () => {
  const verses = [1, 2, 3].map((verse) => createVerse({ verse, x: verse * 10 }));
  const initial = { x: 1, y: 2, zoom: 3 };
  const resolve = (fields: Partial<StoryStop>) =>
    resolveStops(
      [stop(fields)],
      initial,
      verses,
      indexItems(verses),
      { x: 0, y: 0 },
      { width: 400, height: 300 },
      ZOOM,
    )[0].camera;

  it('centres a verse the map holds, at the initial zoom', () => {
    expect(resolve({ pin: verses[1].id })).toEqual({
      ...centreForFocus(verses[1], initial.zoom, { x: 0, y: 0 }, { width: 400, height: 300 }),
      zoom: initial.zoom,
    });
  });

  it('keeps the initial camera for a verse the map does not hold', () => {
    expect(resolve({ pin: 'Genesis.99.1' })).toEqual(initial);
  });
});

describe('resolveStops with a camera naming places', () => {
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
    resolveStops([stop(fields)], initial, verses, indexItems(verses), { x: 0, y: 0 }, map, ZOOM)[0]
      .camera;

  it('fits a book', () => {
    const box = { minX: 90, minY: 100, maxX: 100 + SECTION_LABEL_REACH, maxY: 110 };
    expect(resolve({ camera: { kind: 'places', names: ['I.Samuel'] } })).toEqual(
      cameraToFit(box, 400, 300, ZOOM),
    );
  });

  it('fits several places together', () => {
    const box = { minX: 90, minY: 100, maxX: 200 + SECTION_LABEL_REACH, maxY: 210 };
    expect(resolve({ camera: { kind: 'places', names: ['Neviim', 'Ketuvim'] } })).toEqual(
      cameraToFit(box, 400, 300, ZOOM),
    );
  });

  it('fits everything, at a given zoom', () => {
    const box = { minX: 0, minY: 0, maxX: 200 + SECTION_LABEL_REACH, maxY: 210 };
    expect(resolve({ camera: { kind: 'places', names: ['everything'] }, zoom: 0.5 })).toEqual(
      cameraToFit(box, 400, 300, ZOOM, 0.5),
    );
  });

  it('fits a verse with a region', () => {
    const box = { minX: 0, minY: 0, maxX: 100 + SECTION_LABEL_REACH, maxY: 110 };
    expect(resolve({ camera: { kind: 'places', names: [verses[0].id, 'I.Samuel'] } })).toEqual(
      cameraToFit(box, 400, 300, ZOOM),
    );
  });

  it('centres a camera naming only a verse, at the stop’s zoom', () => {
    expect(resolve({ camera: { kind: 'places', names: [verses[1].id] }, zoom: 2 })).toEqual({
      ...centreForFocus(verses[1], 2, { x: 0, y: 0 }, map),
      zoom: 2,
    });
  });

  it('uses the initial camera when no place is found', () => {
    expect(resolve({ camera: { kind: 'places', names: ['Nowhere'] } })).toEqual(initial);
  });
});
