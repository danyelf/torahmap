import type { StoryData, StoryStop, ResolvedStoryStop, CameraPosition, CameraRef } from './types';
import type { Book, TanakhLayout } from '../types';
import { findTanakhItem } from '../types';
import { parseVerseFromUrl } from '../urlState';
import { parseStoryMarkdown } from './storyParser';
import { getBookSection } from '../constants/books';
import { SECTION_LABEL_REACH } from '../labels';
import { cameraToFit, panToFocus, type ScreenPoint, type WorldBox } from '../camera';

function isVerseRef(cam: CameraRef): cam is { kind: 'verse'; ref: string } {
  return typeof cam === 'object' && 'kind' in cam && cam.kind === 'verse';
}

function isRegions(cam: CameraRef): cam is { kind: 'regions'; names: string[] } {
  return typeof cam === 'object' && 'kind' in cam && cam.kind === 'regions';
}

export async function loadStoryData(): Promise<StoryData> {
  const response = await fetch('/data/story.md');
  const markdown = await response.text();
  return parseStoryMarkdown(markdown);
}

// Minimal markdown-to-HTML for story text: **bold**, *italic*, [links](url),
// paragraphs, and raw HTML (e.g. <span>).
function renderMarkdown(md: string): string {
  return md
    .split(/\n\n+/)
    .map((paragraph) => {
      const html = paragraph
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/\n/g, ' ');
      return `<p>${html}</p>`;
    })
    .join('\n');
}

/** What stands for a stop when the story is folded: its title, or else its first sentence. */
export function stopLabel(stop: Pick<StoryStop, 'title' | 'text'>): string {
  if (stop.title) return stop.title;
  const div = document.createElement('div');
  div.innerHTML = renderMarkdown(stop.text);
  const text = (div.textContent ?? '').replace(/\s+/g, ' ').trim();
  // A sentence can end inside a closing quote or bracket: Abraham.”
  return text.match(/^.*?[.!?]["'”’)\]]*(?=\s|$)/)?.[0] ?? text;
}

export function renderStoryPanel(container: HTMLElement, stops: StoryStop[]): HTMLElement[] {
  container.innerHTML = '';
  const stopElements: HTMLElement[] = [];

  for (const stop of stops) {
    const el = document.createElement('div');
    el.className = 'story-stop';
    el.dataset.stopId = stop.id;

    if (stop.title) {
      const title = document.createElement('h2');
      title.textContent = stop.title;
      el.appendChild(title);
    }

    const textContainer = document.createElement('div');
    textContainer.className = 'story-text';
    textContainer.innerHTML = renderMarkdown(stop.text);
    el.appendChild(textContainer);

    container.appendChild(el);
    stopElements.push(el);
  }

  const ending = document.createElement('button');
  ending.type = 'button';
  ending.className = 'story-leave';
  ending.textContent = 'Explore the map yourself';
  stopElements[stopElements.length - 1]?.appendChild(ending);

  return stopElements;
}

/** A point on the map, in CSS pixels, where the story puts the verse it names. */
function cameraForVerse(verse: TanakhLayout, zoom: number, focus: ScreenPoint): CameraPosition {
  return { ...panToFocus(verse, zoom, focus), zoom };
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
  return verse.book === name.split('.').join(' ');
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
  verses?: TanakhLayout[],
  focus?: ScreenPoint,
  mapSize?: MapSize,
): ResolvedStoryStop[] {
  return stops.map((stop) => {
    const cam = stop.camera;
    let camera: CameraPosition;

    if (isRegions(cam)) {
      const box = verses && mapSize ? regionBox(verses, cam.names) : null;
      camera =
        box && mapSize
          ? cameraToFit(box, mapSize.width, mapSize.height, stop.zoom)
          : { ...initialCamera };
    } else if (isVerseRef(cam)) {
      const zoom = stop.zoom ?? 3;
      const parsed = parseVerseFromUrl(cam.ref);
      const verseLayout = parsed && verses && focus ? findTanakhItem(verses, parsed) : null;
      if (verseLayout && focus) {
        camera = cameraForVerse(verseLayout, zoom, focus);
      } else {
        camera = { ...initialCamera };
      }
    } else if (cam !== 'initial') {
      camera = cam;
    } else if (stop.verse && verses && focus) {
      const parsed = parseVerseFromUrl(stop.verse);
      const verseLayout = parsed ? findTanakhItem(verses, parsed) : null;
      if (verseLayout) {
        camera = cameraForVerse(verseLayout, initialCamera.zoom, focus);
      } else {
        camera = { ...initialCamera };
      }
    } else {
      camera = { ...initialCamera };
    }

    return { ...stop, camera };
  });
}
