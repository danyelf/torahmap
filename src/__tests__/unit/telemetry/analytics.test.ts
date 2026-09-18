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

  it('loads and sends events, reusing one generated visit id, without crypto.randomUUID', async () => {
    // randomUUID lives on Crypto.prototype, so shadow it with an own property
    // rather than `delete`, which would be a no-op on the inherited one.
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    let mod: typeof import('../../../analytics.ts');
    try {
      vi.resetModules();
      const noRandomUuidPath = '../../../analytics.ts?no-random-uuid';
      mod = (await import(
        /* @vite-ignore */ noRandomUuidPath
      )) as typeof import('../../../analytics.ts');
    } finally {
      delete (crypto as { randomUUID?: unknown }).randomUUID;
    }

    const freshSend = vi.fn<(body: string) => void>();
    mod.configureAnalytics({ hostname: 'torahmap.org', send: freshSend, getMode: () => 'explore' });

    expect(() => mod.trackSearchExecute('light', 'en', 'word', 12)).not.toThrow();
    mod.trackSearchExecute('dark', 'en', 'word', 3);

    const visits = freshSend.mock.calls.map(([body]) => JSON.parse(body as string).visit as string);
    expect(visits[0]).toBeTruthy();
    expect(visits[0]).toEqual(visits[1]);
  });
});
