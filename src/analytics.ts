// Events for the site's own Worker (src/worker/index.ts). No cookies and no
// browser storage: the visit id lives in memory, so a reload is a new visit.
import type { TextLanguage } from './types.ts';
import type { SearchMode } from './search/terms.ts';
import type { DriverKind } from './scrollytelling/driver.ts';
import type { ExitHow, ReturnHow } from './telemetry/driverChange.ts';
import type { EventFields, EventName, EventPayload } from './telemetry/schema.ts';
import { linkKind, type UrlState } from '@torahmap/link';

interface Options {
  /** Off on the dev server, which sends nothing. */
  enabled: boolean;
  send: (body: string) => void;
  getMode: () => DriverKind;
  /** The story the reader is in, which every story event names. */
  getStory: () => string;
  visitId: string;
}

const options: Options = {
  enabled: !import.meta.env.DEV,
  send: (body) => navigator.sendBeacon('/api/event', body),
  getMode: () => 'story',
  getStory: () => '',
  visitId: '',
};
let storyStopsSent = new Set<string>();

export function configureAnalytics(changes: Partial<Options>): void {
  if (changes.visitId !== undefined) storyStopsSent = new Set();
  Object.assign(options, changes);
}

// crypto.randomUUID needs a secure context (HTTPS) and a recent browser;
// getRandomValues works everywhere, including plain http and older Safari.
function makeVisitId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function track<E extends EventName>(event: E, fields: EventFields<E>): void {
  if (!options.enabled) return;
  if (!options.visitId) options.visitId = makeVisitId();
  const payload: EventPayload<E> = {
    event,
    visit: options.visitId,
    mode: options.getMode(),
    fields,
  };
  options.send(JSON.stringify(payload));
}

/** The story and stop as the link named them, which need not be what opened. */
export function trackPageView(
  story: string,
  storyStop: string,
  referrer: string,
  arrival: ReturnType<typeof arrivedWith>,
): void {
  track('page_view', { story_stop: storyStop, referrer, story, arrived_with: arrival });
}

/** What the first page's link named; a reload or Back/Forward is not an arrival. */
export function arrivedWith(
  state: UrlState,
  navigationType: string | undefined,
): 'nothing' | 'view' | 'stop' {
  if (navigationType === 'reload' || navigationType === 'back_forward') return 'nothing';
  return linkKind(state);
}

export function trackShare(fields: EventFields<'share'>): void {
  track('share', fields);
}

export function trackStoryStop(stopId: string, stopNumber: number, totalStops: number): void {
  const story = options.getStory();
  const key = `${story}/${stopId}`;
  if (storyStopsSent.has(key)) return;
  storyStopsSent.add(key);
  track('story_stop', { stop_id: stopId, story, stop_number: stopNumber, total_stops: totalStops });
}

export function trackStoryExit(stopId: string, stopNumber: number, how: ExitHow): void {
  track('story_exit', { stop_id: stopId, stop_number: stopNumber, how, story: options.getStory() });
}

export function trackStoryReturn(stopId: string, how: ReturnHow): void {
  track('story_return', { stop_id: stopId, how, story: options.getStory() });
}

export function trackViewSettled(book: string, section: string, zoom: number): void {
  const zoomBand = zoom > 3 ? 'close' : zoom >= 1 ? 'medium' : 'far';
  track('view_settled', { book, section, zoom_band: zoomBand, zoom: Math.round(zoom * 100) / 100 });
}

export function trackOverlaySwitch(overlay: string, previousOverlay: string): void {
  track('overlay_switch', { overlay, previous_overlay: previousOverlay });
}

export function trackSearchExecute(
  term: string,
  language: TextLanguage,
  searchMode: SearchMode,
  resultCount: number,
): void {
  track('search_execute', {
    term: term.slice(0, 40),
    language,
    search_mode: searchMode,
    result_count: resultCount,
  });
}

export function trackVerseClick(book: string, chapter: number, verse: number): void {
  track('verse_click', { book, chapter, verse });
}

export function trackWordMenuOpen(
  word: string,
  verse: string,
  meanings: number,
  paletteFull: boolean,
): void {
  track('word_menu_open', { word, verse, meanings, palette_full: paletteFull ? 'yes' : 'no' });
}

export function trackWordSearch(word: string, choice: string, verse: string): void {
  track('word_search', { word, choice, verse });
}

export function trackSefariaClick(
  book: string,
  chapter: number,
  verse: number,
  overlay: string,
): void {
  track('sefaria_click', { book, chapter, verse, overlay });
}
