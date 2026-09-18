// The one place that says which Analytics Engine column holds what. Columns
// are positional: blob1-4 and index1 are common to every event, then each
// event's own strings from blob5 and numbers from double1, in the order below.
// Appending a field is safe; reordering one silently changes what old rows mean.

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
type Blobs<E extends EventName> = (typeof EVENTS)[E]['blobs'][number];
type Doubles<E extends EventName> = (typeof EVENTS)[E]['doubles'][number];
export type EventFields<E extends EventName> = { [K in Blobs<E>]: string } & {
  [K in Doubles<E>]: number;
};

export type Mode = 'story' | 'explore';

export interface EventPayload {
  event: string;
  visit: string;
  mode: string;
  fields: Record<string, unknown>;
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

/** The data point for a payload from the page, or null if it is not one we accept. */
export function toDataPoint(
  payload: unknown,
  context: { country: string; device: string },
): DataPoint | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const { event, visit, mode, fields } = payload as Partial<EventPayload>;
  if (!isEventName(event)) return null;
  if (typeof visit !== 'string' || visit.length === 0 || visit.length > 64) return null;
  if (mode !== 'story' && mode !== 'explore') return null;
  const given = typeof fields === 'object' && fields !== null ? fields : {};

  const schema = EVENTS[event];
  const blob = (name: string) => {
    const value = given[name];
    return typeof value === 'string' ? value.slice(0, MAX_BLOB_CHARS) : '';
  };
  const double = (name: string) => {
    const value = given[name];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  };

  return {
    indexes: [visit],
    blobs: [event, mode, context.country, context.device, ...schema.blobs.map(blob)],
    doubles: schema.doubles.map(double),
  };
}
