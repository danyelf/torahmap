// Events for the site's own Worker (src/worker/index.ts). No cookies and no
// browser storage: the visit id lives in memory, so a reload is a new visit.
import type { TextLanguage } from './types.ts';
import type { DriverKind } from './scrollytelling/driver.ts';
import type { ExitHow, ReturnHow } from './telemetry/driverChange.ts';
import {
  errorMessage,
  MAX_BLOB_CHARS,
  type ErrorSource,
  type EventFields,
  type EventName,
  type EventPayload,
} from './telemetry/schema.ts';
import { linkKind, type LinkKind, type UrlState } from '@torahmap/link';

interface Options {
  /**
   * On only in a Vite production build: off on the dev server, and in a plain
   * Node script (the print scripts), which has no import.meta.env.
   */
  enabled: boolean;
  send: (body: string) => void;
  getMode: () => DriverKind;
  /** The story the reader is in, which every story event names. */
  getStory: () => string;
  visitId: string;
}

const options: Options = {
  enabled: import.meta.env?.DEV === false,
  send: (body) => navigator.sendBeacon('/api/event', body),
  getMode: () => 'story',
  getStory: () => '',
  visitId: '',
};
let storyStopsSent = new Set<string>();
let errorsSent = new Set<string>();

export function configureAnalytics(changes: Partial<Options>): void {
  if (changes.visitId !== undefined) {
    storyStopsSent = new Set();
    errorsSent = new Set();
  }
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
  arrival: LinkKind,
  visited: boolean,
): void {
  track('page_view', {
    story_stop: storyStop,
    referrer,
    story,
    arrived_with: arrival,
    visited: visited ? 'yes' : 'no',
  });
}

/** What the first page's link named; a reload or Back/Forward is not an arrival. */
export function arrivedWith(state: UrlState, navigationType: string | undefined): LinkKind {
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

export function trackViewSettled(area: string, section: string, zoom: number): void {
  const zoomBand = zoom > 3 ? 'close' : zoom >= 1 ? 'medium' : 'far';
  track('view_settled', { area, section, zoom_band: zoomBand, zoom: Math.round(zoom * 100) / 100 });
}

export function trackOverlaySwitch(overlay: string, previousOverlay: string): void {
  track('overlay_switch', { overlay, previous_overlay: previousOverlay });
}

export function trackSearchExecute(
  term: string,
  language: TextLanguage,
  searchMode: string,
  resultCount: number,
): void {
  track('search_execute', {
    term: term.slice(0, 40),
    language,
    search_mode: searchMode,
    result_count: resultCount,
  });
}

export function trackSquareClick(id: string, area: string): void {
  track('square_click', { id, area });
}

export function trackWordMenuOpen(
  word: string,
  id: string,
  meanings: number,
  paletteFull: boolean,
): void {
  track('word_menu_open', { word, id, meanings, palette_full: paletteFull ? 'yes' : 'no' });
}

export function trackWordSearch(word: string, choice: string, id: string): void {
  track('word_search', { word, choice, id });
}

export function trackSefariaOpen(id: string, area: string, overlay: string): void {
  track('sefaria_open', { id, area, overlay });
}

export function trackWebGLMissing(): void {
  track('webgl_missing', {});
}

/**
 * Sends each distinct error once per visit, cut to the column's width so a
 * long message cannot push the body past MAX_BODY_BYTES.
 */
function trackError(source: ErrorSource, text: string): void {
  const message = text.slice(0, MAX_BLOB_CHARS);
  const key = `${source}\n${message}`;
  if (errorsSent.has(key)) return;
  errorsSent.add(key);
  track('error', { source, message });
}

/** Logs an error the page handled, and reports it, after `context` if given. */
export function reportError(source: ErrorSource, error: unknown, context?: string): void {
  console.error(context ? `${source}: ${context}:` : `${source}:`, error);
  trackError(source, context ? `${context}: ${errorMessage(error)}` : errorMessage(error));
}

// The browser's notice that a resize observer was held over a frame. On a
// phone the map resizes as the sheet does, inside the sheet's observer, so it
// redraws a frame late — expected, not a fault.
const RESIZE_OBSERVER_LOOP = /^ResizeObserver loop/;

/** Reports what nothing caught; the browser has already logged it. */
export function reportUncaughtErrors(target: Window = window): void {
  target.addEventListener('error', (e) => {
    if (!e.error && RESIZE_OBSERVER_LOOP.test(e.message)) return;
    trackError('uncaught', errorMessage(e.error ?? e.message));
  });
  target.addEventListener('unhandledrejection', (e) =>
    trackError('unhandled_rejection', errorMessage(e.reason)),
  );
}

export function trackLoadTiming(fields: EventFields<'load_timing'>): void {
  track('load_timing', fields);
}

/** Kilobits per second over a download's body, or 0 where the browser did not report one. */
export function downloadKbps(
  entry:
    Pick<PerformanceResourceTiming, 'transferSize' | 'responseStart' | 'responseEnd'> | undefined,
): number {
  if (!entry) return 0;
  const ms = entry.responseEnd - entry.responseStart;
  if (entry.transferSize <= 0 || ms <= 0) return 0;
  return Math.round((entry.transferSize * 8) / ms);
}
