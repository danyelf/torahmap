import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureAnalytics,
  trackSearchExecute,
  trackStoryStop,
  trackViewSettled,
} from '../../../analytics.ts';

let send: ReturnType<typeof vi.fn>;

beforeEach(() => {
  send = vi.fn();
  configureAnalytics({ hostname: 'torahmap.org', send, getMode: () => 'explore', visitId: 'v1' });
});

const sent = () => send.mock.calls.map(([body]) => JSON.parse(body as string));

describe('analytics', () => {
  it('sends the event with the visit id and the current mode', () => {
    trackSearchExecute('light', 'en', 'word', 12);
    expect(sent()).toEqual([
      {
        event: 'search_execute',
        visit: 'v1',
        mode: 'explore',
        fields: { term: 'light', language: 'en', search_mode: 'word', result_count: 12 },
      },
    ]);
  });

  it('sends nothing off torahmap.org', () => {
    configureAnalytics({ hostname: 'localhost' });
    trackSearchExecute('light', 'en', 'word', 12);
    configureAnalytics({ hostname: 'torahmap.workers.dev' });
    trackSearchExecute('light', 'en', 'word', 12);
    expect(send).not.toHaveBeenCalled();
  });

  it('sends each story stop once per visit', () => {
    trackStoryStop('creation', 1, 9);
    trackStoryStop('flood', 2, 9);
    trackStoryStop('creation', 1, 9);
    expect(sent().map((e) => e.fields.stop_id)).toEqual(['creation', 'flood']);
  });

  it('counts stops afresh for a new visit', () => {
    trackStoryStop('creation', 1, 9);
    configureAnalytics({ visitId: 'v2' });
    trackStoryStop('creation', 1, 9);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('bands the zoom of a settled view', () => {
    trackViewSettled('Isaiah', 'neviim', 4);
    trackViewSettled('Isaiah', 'neviim', 0.5);
    expect(sent().map((e) => e.fields.zoom_band)).toEqual(['close', 'far']);
  });
});
