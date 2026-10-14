// Where a Tanakh story's stops put the camera: places on the map by name.

import {
  type CameraPosition,
  type ItemIndex,
  type ZoomRange,
  cameraToFit,
  centreForFocus,
  type ScreenPoint,
  type WorldBox,
} from '@torahmap/engine';
import type { StoryStop, CameraRef } from '@torahmap/stories';
import type { ResolvedStoryStop } from '../scrollytelling/types.ts';
import type { Book, TanakhLayout } from '../types.ts';
import { bookFromUrl } from '@torahmap/link';
import { getBookSection } from '../constants/books.ts';
import { SECTION_LABEL_REACH } from '../labels.ts';

function isPlaces(cam: CameraRef): cam is { kind: 'places'; names: string[] } {
  return typeof cam === 'object' && 'kind' in cam && cam.kind === 'places';
}

/** The camera that puts a verse at `focus`. */
function cameraForVerse(
  verse: TanakhLayout,
  zoom: number,
  focus: ScreenPoint,
  mapSize: MapSize,
): CameraPosition {
  return { ...centreForFocus(verse, zoom, focus, mapSize), zoom };
}

const SECTIONS: Record<string, Book['section']> = {
  Torah: 'torah',
  Neviim: 'neviim',
  Ketuvim: 'ketuvim',
};

/** Whether `verse` is in the region `name`: everything, a section, or a book. */
function inRegion(verse: TanakhLayout, name: string): boolean {
  if (name === 'everything') return true;
  const section = SECTIONS[name];
  if (section) return getBookSection(verse.book) === section;
  return verse.book === bookFromUrl(name);
}

/** The verses in the place `name`: the verse with that id, or every verse in that region. */
function versesIn(
  verses: TanakhLayout[],
  squares: ItemIndex<TanakhLayout>,
  name: string,
): TanakhLayout[] {
  const verse = squares.find(name);
  return verse ? [verse] : verses.filter((v) => inRegion(v, name));
}

/** Whether `name` is a place on the map. */
export function namesPlace(
  verses: TanakhLayout[],
  squares: ItemIndex<TanakhLayout>,
  name: string,
): boolean {
  return versesIn(verses, squares, name).length > 0;
}

/**
 * The box around every verse in the named places and the section label to
 * their right, or null if they hold none.
 */
function placeBox(
  verses: TanakhLayout[],
  squares: ItemIndex<TanakhLayout>,
  names: string[],
): WorldBox | null {
  const inside = names.flatMap((name) => {
    const found = versesIn(verses, squares, name);
    if (found.length === 0) console.warn(`[story] no place named "${name}"`);
    return found;
  });
  if (inside.length === 0) return null;
  return {
    minX: Math.min(...inside.map((v) => v.x)),
    minY: Math.min(...inside.map((v) => v.y)),
    maxX: Math.max(...inside.map((v) => v.x + v.size)) + SECTION_LABEL_REACH,
    maxY: Math.max(...inside.map((v) => v.y + v.size)),
  };
}

/** The map's canvas, in CSS pixels. */
export interface MapSize {
  width: number;
  height: number;
}

// "initial" uses the app's default camera position, unless the stop pins a
// verse, in which case that verse is put at `focus` instead. A camera naming
// one verse puts it at `focus` too; any other places are fitted to `mapSize`.
export function resolveStops(
  stops: StoryStop[],
  initialCamera: CameraPosition,
  verses: TanakhLayout[],
  squares: ItemIndex<TanakhLayout>,
  focus: ScreenPoint,
  mapSize: MapSize,
  zoom: ZoomRange,
): ResolvedStoryStop[] {
  return stops.map((stop) => {
    const cam = stop.camera;
    let camera: CameraPosition;

    if (isPlaces(cam)) {
      const verse = cam.names.length === 1 ? squares.find(cam.names[0]) : undefined;
      const box = verse ? null : placeBox(verses, squares, cam.names);
      camera = verse
        ? cameraForVerse(verse, stop.zoom ?? 3, focus, mapSize)
        : box
          ? cameraToFit(box, mapSize.width, mapSize.height, zoom, stop.zoom)
          : { ...initialCamera };
    } else if (cam !== 'initial') {
      camera = cam;
    } else if (stop.pin) {
      const verse = squares.find(stop.pin);
      camera = verse
        ? cameraForVerse(verse, initialCamera.zoom, focus, mapSize)
        : { ...initialCamera };
    } else {
      camera = { ...initialCamera };
    }

    return { ...stop, camera };
  });
}
