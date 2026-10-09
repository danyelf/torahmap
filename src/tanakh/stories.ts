// Where a Tanakh story's stops put the camera: a verse, or regions of the map by name.

import type { StoryStop, CameraPosition, CameraRef } from '@torahmap/stories';
import type { ResolvedStoryStop } from '../scrollytelling/types.ts';
import type { Book, TanakhLayout } from '../types.ts';
import type { ItemIndex } from '../items.ts';
import { bookFromUrl } from '@torahmap/link';
import { getBookSection } from '../constants/books.ts';
import { SECTION_LABEL_REACH } from '../labels.ts';
import { cameraToFit, centreForFocus, type ScreenPoint, type WorldBox } from '../camera.ts';

function isVerseRef(cam: CameraRef): cam is { kind: 'verse'; ref: string } {
  return typeof cam === 'object' && 'kind' in cam && cam.kind === 'verse';
}

function isRegions(cam: CameraRef): cam is { kind: 'regions'; names: string[] } {
  return typeof cam === 'object' && 'kind' in cam && cam.kind === 'regions';
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

function inRegion(verse: TanakhLayout, name: string): boolean {
  if (name === 'everything') return true;
  const section = SECTIONS[name];
  if (section) return getBookSection(verse.book) === section;
  return verse.book === bookFromUrl(name);
}

/** Whether `name` is a region of the map: everything, a section or a book. */
export function namesRegion(verses: TanakhLayout[], name: string): boolean {
  return verses.some((v) => inRegion(v, name));
}

/**
 * The box around every verse in the named regions and the section label to
 * their right, or null if they hold none.
 */
function regionBox(verses: TanakhLayout[], names: string[]): WorldBox | null {
  const inside = names.flatMap((name) => {
    const found = verses.filter((v) => inRegion(v, name));
    if (found.length === 0) console.warn(`[story] no region named "${name}"`);
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

// "initial" uses the app's default camera position, unless the stop names a
// verse to pin on, in which case that verse is put at `focus` instead. A region
// camera fits its regions to `mapSize`.
export function resolveStops(
  stops: StoryStop[],
  initialCamera: CameraPosition,
  verses: TanakhLayout[],
  squares: ItemIndex<TanakhLayout>,
  focus: ScreenPoint,
  mapSize: MapSize,
): ResolvedStoryStop[] {
  return stops.map((stop) => {
    const cam = stop.camera;
    let camera: CameraPosition;

    if (isRegions(cam)) {
      const box = regionBox(verses, cam.names);
      camera = box
        ? cameraToFit(box, mapSize.width, mapSize.height, stop.zoom)
        : { ...initialCamera };
    } else if (isVerseRef(cam)) {
      const zoom = stop.zoom ?? 3;
      const verseLayout = squares.find(cam.ref);
      if (verseLayout) {
        camera = cameraForVerse(verseLayout, zoom, focus, mapSize);
      } else {
        camera = { ...initialCamera };
      }
    } else if (cam !== 'initial') {
      camera = cam;
    } else if (stop.verse) {
      const verseLayout = squares.find(stop.verse);
      if (verseLayout) {
        camera = cameraForVerse(verseLayout, initialCamera.zoom, focus, mapSize);
      } else {
        camera = { ...initialCamera };
      }
    } else {
      camera = { ...initialCamera };
    }

    return { ...stop, camera };
  });
}
