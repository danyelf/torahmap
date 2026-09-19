// The one definition of which Analytics Engine column holds what; the queries
// in scripts/telemetry are checked against it by queries.test.ts. Columns are
// positional: index1 is the visit id, the blobs start with COMMON_COLUMNS,
// then each event's own strings follow, and its numbers start at double1.
// Appending a field is safe; reordering one silently changes what old rows mean.

import { MODES, type Mode } from '../scrollytelling/modeSwitch.ts';

const COMMON_COLUMNS = ['event', 'mode', 'country', 'device', 'host'] as const;
type CommonColumn = (typeof COMMON_COLUMNS)[number];

export const EVENTS = {
  page_view: { blobs: ['story_stop', 'referrer'], doubles: [] },
  story_stop: { blobs: ['stop_id'], doubles: ['stop_number', 'total_stops'] },
  story_exit: { blobs: ['stop_id'], doubles: ['stop_number'] },
  story_return: { blobs: ['stop_id'], doubles: [] },
  view_settled: { blobs: ['book', 'section', 'zoom_band'], doubles: ['zoom'] },
  overlay_switch: { blobs: ['overlay', 'previous_overlay'], doubles: [] },
  search_execute: { blobs: ['term', 'language', 'search_mode'], doubles: ['result_count'] },
  verse_click: { blobs: ['book'], doubles: ['chapter', 'verse'] },
  word_menu_open: { blobs: ['word', 'verse', 'palette_full'], doubles: ['meanings'] },
  word_search: { blobs: ['word', 'choice', 'verse'], doubles: [] },
  sefaria_click: { blobs: ['book', 'overlay'], doubles: ['chapter', 'verse'] },
} as const satisfies Record<string, { blobs: readonly string[]; doubles: readonly string[] }>;

export type EventName = keyof typeof EVENTS;

/** An event's columns in order: its strings from blob1, its numbers from double1. */
export function columns(event: EventName): { blobs: string[]; doubles: string[] } {
  return {
    blobs: [...COMMON_COLUMNS, ...EVENTS[event].blobs],
    doubles: [...EVENTS[event].doubles],
  };
}
type Blobs<E extends EventName> = (typeof EVENTS)[E]['blobs'][number];
type Doubles<E extends EventName> = (typeof EVENTS)[E]['doubles'][number];
export type EventFields<E extends EventName> = { [K in Blobs<E>]: string } & {
  [K in Doubles<E>]: number;
};

/** The body the page sends to /api/event. */
export interface EventPayload<E extends EventName = EventName> {
  event: E;
  visit: string;
  mode: Mode;
  fields: EventFields<E>;
}

export interface DataPoint {
  indexes: string[];
  blobs: string[];
  doubles: number[];
}

export const MAX_BODY_BYTES = 2048;
const MAX_BLOB_CHARS = 100;

function isEventName(name: unknown): name is EventName {
  return typeof name === 'string' && Object.prototype.hasOwnProperty.call(EVENTS, name);
}

function isMode(mode: unknown): mode is Mode {
  return (MODES as readonly unknown[]).includes(mode);
}

/** The data point for a payload from the page, or null if it is not one we accept. */
export function toDataPoint(
  payload: unknown,
  context: Record<Exclude<CommonColumn, 'event' | 'mode'>, string>,
): DataPoint | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const { event, visit, mode, fields } = payload as { [K in keyof EventPayload]?: unknown };
  if (!isEventName(event)) return null;
  if (typeof visit !== 'string' || visit.length === 0 || visit.length > 64) return null;
  if (!isMode(mode)) return null;
  const given: Record<string, unknown> =
    typeof fields === 'object' && fields !== null ? (fields as Record<string, unknown>) : {};

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
    indexes: [visit],
    blobs: blobs.map((name, i) => (i < COMMON_COLUMNS.length ? common[name] : blob(name))),
    doubles: doubles.map(double),
  };
}
