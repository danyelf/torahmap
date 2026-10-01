// The one definition of which Analytics Engine column holds what; the queries
// in scripts/telemetry are checked against it by queries.test.ts. Columns are
// positional: index1 is the visit id for an event the page sends, or the
// event name for one the Worker writes on its own; the blobs start with
// COMMON_COLUMNS, then each event's own strings follow, and its numbers
// start at double1. Appending a field is safe; reordering one silently
// changes what old rows mean.

import type { LinkKind } from '@torahmap/link';
import { DRIVER_KINDS, type DriverKind } from '../scrollytelling/driver.ts';

const COMMON_COLUMNS = ['event', 'mode', 'country', 'device', 'host'] as const;
type CommonColumn = (typeof COMMON_COLUMNS)[number];
export type RequestContext = Record<Exclude<CommonColumn, 'event' | 'mode'>, string>;

export const EVENTS = {
  // arrived_with is blank on views recorded before the column existed —
  // "not stated", unlike arrivedWith's own 'nothing' for a reload or Back/Forward.
  // visited is 'yes' once this browser has left the story or gone past its
  // first stop on an earlier visit (main.ts's rememberVisit), so a return by
  // someone who bounced off the first stop reads 'no'.
  page_view: {
    blobs: ['story_stop', 'referrer', 'story', 'arrived_with', 'visited'],
    doubles: [],
  },
  story_stop: { blobs: ['stop_id', 'story'], doubles: ['stop_number', 'total_stops'] },
  story_exit: { blobs: ['stop_id', 'how', 'story'], doubles: ['stop_number'] },
  story_return: { blobs: ['stop_id', 'how', 'story'], doubles: [] },
  view_settled: { blobs: ['book', 'section', 'zoom_band'], doubles: ['zoom'] },
  overlay_switch: { blobs: ['overlay', 'previous_overlay'], doubles: [] },
  search_execute: { blobs: ['term', 'language', 'search_mode'], doubles: ['result_count'] },
  verse_click: { blobs: ['book'], doubles: ['chapter', 'verse'] },
  word_menu_open: { blobs: ['word', 'verse', 'palette_full'], doubles: ['meanings'] },
  word_search: { blobs: ['word', 'choice', 'verse'], doubles: [] },
  sefaria_click: { blobs: ['book', 'overlay'], doubles: ['chapter', 'verse'] },
  webgl_missing: { blobs: [], doubles: [] },
  error: { blobs: ['source', 'message'], doubles: [] },
  link_preview: { blobs: ['fetcher', 'what'], doubles: [], by: 'worker' },
  worker_error: { blobs: ['source', 'message'], doubles: [], by: 'worker' },
  // A stop share records overlay 'none': stop links carry no overlay (the stop
  // picks its own), so group share.overlay by view shares.
  share: {
    blobs: ['how', 'what', 'story', 'stop_id', 'overlay'],
    doubles: ['searching', 'pinned'],
  },
} as const satisfies Record<
  string,
  { blobs: readonly string[]; doubles: readonly string[]; by?: 'worker' }
>;

export type EventName = keyof typeof EVENTS;

export type WorkerEvent = {
  [E in EventName]: (typeof EVENTS)[E] extends { by: 'worker' } ? E : never;
}[EventName];

/** Events only the Worker writes; toDataPoint refuses them from the page. */
export const WORKER_EVENTS: ReadonlySet<EventName> = new Set(
  (Object.keys(EVENTS) as EventName[]).filter((e) => 'by' in EVENTS[e]),
);

/** An event's columns in order: its strings from blob1, its numbers from double1. */
export function columns(event: EventName): { blobs: string[]; doubles: string[] } {
  return {
    blobs: [...COMMON_COLUMNS, ...EVENTS[event].blobs],
    doubles: [...EVENTS[event].doubles],
  };
}
type Blobs<E extends EventName> = (typeof EVENTS)[E]['blobs'][number];
type Doubles<E extends EventName> = (typeof EVENTS)[E]['doubles'][number];
// Columns narrower than a string, matched by column name in every event.
interface NarrowBlobs {
  arrived_with: LinkKind;
  what: LinkKind;
  source: ErrorSource;
}
export type EventFields<E extends EventName> = {
  [K in Blobs<E>]: K extends keyof NarrowBlobs ? NarrowBlobs[K] : string;
} & {
  [K in Doubles<E>]: number;
};

/** The body the page sends to /api/event. */
export interface EventPayload<E extends EventName = EventName> {
  event: E;
  visit: string;
  mode: DriverKind;
  fields: EventFields<E>;
}

export interface DataPoint {
  indexes: string[];
  blobs: string[];
  doubles: number[];
}

export const MAX_BODY_BYTES = 2048;
export const MAX_BLOB_CHARS = 100;

/** The source column of error and worker_error; errors.sql groups by it. */
export type ErrorSource =
  'main' | 'layout' | 'loadJson' | 'uncaught' | 'unhandled_rejection' | 'linkPage';

export function errorMessage(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function isEventName(name: unknown): name is EventName {
  return typeof name === 'string' && Object.prototype.hasOwnProperty.call(EVENTS, name);
}

function isMode(mode: unknown): mode is DriverKind {
  return (DRIVER_KINDS as readonly unknown[]).includes(mode);
}

/** The data point for a payload from the page, or null if it is not one we accept. */
export function toDataPoint(payload: unknown, context: RequestContext): DataPoint | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const { event, visit, mode, fields } = payload as { [K in keyof EventPayload]?: unknown };
  if (!isEventName(event)) return null;
  if (WORKER_EVENTS.has(event)) return null;
  if (typeof visit !== 'string' || visit.length === 0 || visit.length > 64) return null;
  if (!isMode(mode)) return null;
  const given: Record<string, unknown> =
    typeof fields === 'object' && fields !== null ? (fields as Record<string, unknown>) : {};
  return dataPoint(event, visit, mode, context, given);
}

/**
 * A data point for an event the Worker observes on its own, with no page
 * visit to index by — the event name serves as the index instead. There is
 * no mode, since nothing is driving a story.
 */
export function workerDataPoint<E extends WorkerEvent>(
  event: E,
  fields: EventFields<E>,
  context: RequestContext,
): DataPoint {
  return dataPoint(event, event, '', context, fields);
}

function dataPoint(
  event: EventName,
  index: string,
  mode: string,
  context: RequestContext,
  given: Record<string, unknown>,
): DataPoint {
  const blob = (name: string) => {
    const value = given[name];
    return typeof value === 'string' ? value.slice(0, MAX_BLOB_CHARS) : '';
  };
  const double = (name: string) => {
    const value = given[name];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  };

  const common: Record<string, string> = { event, mode, ...context };
  const { blobs, doubles } = columns(event);
  return {
    indexes: [index],
    blobs: blobs.map((name, i) => (i < COMMON_COLUMNS.length ? common[name] : blob(name))),
    doubles: doubles.map(double),
  };
}
