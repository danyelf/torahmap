// Events for the site's own Worker (src/worker/index.ts). No cookies and no
// browser storage: the visit id lives in memory, so a reload is a new visit.
import type { TextLanguage } from './types.ts';
import type { SearchMode } from './search/terms.ts';
import type { Mode } from './scrollytelling/modeSwitch.ts';
import type { EventFields, EventName, EventPayload } from './telemetry/schema.ts';

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** True for the dev server: no host, localhost, an IPv6 loopback, a LAN IPv4 address, or an mDNS `.local` name. */
function isDevHost(hostname: string): boolean {
  if (hostname === '' || hostname === 'localhost') return true;
  if (hostname === '::1' || hostname === '[::1]') return true;
  if (hostname.endsWith('.local')) return true;
  return IPV4.test(hostname);
}

interface Options {
  hostname: string;
  send: (body: string) => void;
  getMode: () => Mode;
  visitId: string;
}

const options: Options = {
  hostname: typeof location === 'undefined' ? '' : location.hostname,
  send: (body) => navigator.sendBeacon('/api/event', body),
  getMode: () => 'story',
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
  if (isDevHost(options.hostname)) return;
  if (!options.visitId) options.visitId = makeVisitId();
  const payload: EventPayload<E> = {
    event,
    visit: options.visitId,
    mode: options.getMode(),
    fields,
  };
  options.send(JSON.stringify(payload));
}

export function trackPageView(storyStop: string, referrer: string): void {
  track('page_view', { story_stop: storyStop, referrer });
}

export function trackStoryStop(stopId: string, stopNumber: number, totalStops: number): void {
  if (storyStopsSent.has(stopId)) return;
  storyStopsSent.add(stopId);
  track('story_stop', { stop_id: stopId, stop_number: stopNumber, total_stops: totalStops });
}

export function trackStoryExit(stopId: string, stopNumber: number): void {
  track('story_exit', { stop_id: stopId, stop_number: stopNumber });
}

export function trackStoryReturn(stopId: string): void {
  track('story_return', { stop_id: stopId });
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
