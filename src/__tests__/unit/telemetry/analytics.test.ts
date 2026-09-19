import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureAnalytics,
  trackModeChange,
  trackSearchExecute,
  trackStoryStop,
  trackViewSettled,
} from '../../../analytics.ts';

let send: ReturnType<typeof vi.fn<(body: string) => void>>;

beforeEach(() => {
  send = vi.fn<(body: string) => void>();
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

  it('sends from a workers.dev preview host, not only torahmap.org', () => {
    configureAnalytics({ hostname: 'telemetry-torahmap.example.workers.dev' });
    trackSearchExecute('light', 'en', 'word', 12);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends nothing from the dev server', () => {
    for (const hostname of ['localhost', '127.0.0.1', '192.168.1.20', '::1', 'mac.local', '']) {
      configureAnalytics({ hostname });
      trackSearchExecute('light', 'en', 'word', 12);
    }
    expect(send).not.toHaveBeenCalled();
  });

  it('generates one visit id and reuses it across events', () => {
    configureAnalytics({ visitId: '' });
    trackSearchExecute('light', 'en', 'word', 12);
    trackSearchExecute('dark', 'en', 'word', 3);
    const [first, second] = sent().map((e) => e.visit as string);
    expect(first).toBeTruthy();
    expect(second).toBe(first);
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

  it('sends story_exit leaving the story and story_return coming back', () => {
    trackModeChange('story', 'explore', 'sinai', 4);
    trackModeChange('explore', 'story', 'flood', 2);
    expect(sent().map((e) => [e.event, e.fields])).toEqual([
      ['story_exit', { stop_id: 'sinai', stop_number: 4 }],
      ['story_return', { stop_id: 'flood' }],
    ]);
  });

  it('sends nothing when the mode does not change', () => {
    trackModeChange('story', 'story', 'sinai', 4);
    trackModeChange('explore', 'explore', 'sinai', 4);
    expect(send).not.toHaveBeenCalled();
  });

  it('bands the zoom of a settled view', () => {
    trackViewSettled('Isaiah', 'neviim', 4);
    trackViewSettled('Isaiah', 'neviim', 0.5);
    expect(sent().map((e) => e.fields.zoom_band)).toEqual(['close', 'far']);
  });
});
