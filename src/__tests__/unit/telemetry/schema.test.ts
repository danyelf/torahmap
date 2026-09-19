import { describe, expect, it } from 'vitest';
import { MODES } from '../../../scrollytelling/modeSwitch.ts';
import { toDataPoint } from '../../../telemetry/schema.ts';

const context = { country: 'IL', device: 'mobile', host: 'torahmap.org' };

describe('toDataPoint', () => {
  it('accepts exactly the modes in MODES', () => {
    for (const mode of MODES) {
      expect(toDataPoint({ event: 'page_view', visit: 'v', mode, fields: {} }, context)).not.toBe(
        null,
      );
    }
    expect(MODES).toEqual(['story', 'explore']);
  });

  it('lays out common columns, then the event fields in schema order', () => {
    const point = toDataPoint(
      {
        event: 'story_stop',
        visit: 'v1',
        mode: 'story',
        fields: { stop_id: 'abraham', stop_number: 3, total_stops: 9 },
      },
      context,
    );
    expect(point).toEqual({
      indexes: ['v1'],
      blobs: ['story_stop', 'story', 'IL', 'mobile', 'torahmap.org', 'abraham'],
      doubles: [3, 9],
    });
  });

  it('fills a missing field with an empty string or zero', () => {
    const point = toDataPoint(
      { event: 'view_settled', visit: 'v1', mode: 'explore', fields: { book: 'Genesis' } },
      context,
    );
    expect(point?.blobs).toEqual([
      'view_settled',
      'explore',
      'IL',
      'mobile',
      'torahmap.org',
      'Genesis',
      '',
      '',
    ]);
    expect(point?.doubles).toEqual([0]);
  });

  it('rejects an unknown event, a bad mode and a missing visit id', () => {
    expect(
      toDataPoint({ event: 'nope', visit: 'v', mode: 'story', fields: {} }, context),
    ).toBeNull();
    expect(
      toDataPoint({ event: 'page_view', visit: 'v', mode: 'x', fields: {} }, context),
    ).toBeNull();
    expect(
      toDataPoint({ event: 'page_view', visit: '', mode: 'story', fields: {} }, context),
    ).toBeNull();
    expect(toDataPoint('junk', context)).toBeNull();
  });

  it('truncates long strings and ignores fields of the wrong type', () => {
    const point = toDataPoint(
      {
        event: 'search_execute',
        visit: 'v',
        mode: 'explore',
        fields: {
          term: 'x'.repeat(500),
          language: 7,
          search_mode: 'meanings',
          result_count: 'many',
        },
      },
      context,
    );
    expect(point?.blobs[5]).toHaveLength(100);
    expect(point?.blobs[6]).toBe('');
    expect(point?.doubles).toEqual([0]);
  });
});
