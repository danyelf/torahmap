import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureAnalytics,
  trackStoryExit,
  trackStoryReturn,
  trackSearchExecute,
  trackStoryStop,
  trackViewSettled,
} from '../../../analytics.ts';

let send: ReturnType<typeof vi.fn<(body: string) => void>>;

beforeEach(() => {
  send = vi.fn<(body: string) => void>();
  configureAnalytics({
    enabled: true,
    send,
    getMode: () => 'reader',
    getStory: () => 'tour',
    visitId: 'v1',
  });
});

const sent = () => send.mock.calls.map(([body]) => JSON.parse(body as string));

describe('analytics', () => {
  it('sends the event with the visit id and the current mode', () => {
    trackSearchExecute('light', 'en', 'word', 12);
    expect(sent()).toEqual([
      {
        event: 'search_execute',
        visit: 'v1',
        mode: 'reader',
        fields: { term: 'light', language: 'en', search_mode: 'word', result_count: 12 },
      },
    ]);
  });

  it('sends nothing while switched off, as on the dev server', () => {
    configureAnalytics({ enabled: false });
    trackSearchExecute('light', 'en', 'word', 12);
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

  it('sends a stop once per story, though two stories share its id', () => {
    trackStoryStop('intro', 1, 9);
    configureAnalytics({ getStory: () => 'job' });
    trackStoryStop('intro', 1, 4);
    configureAnalytics({ getStory: () => 'tour' });
    trackStoryStop('intro', 1, 9);
    expect(sent().map((e) => `${e.fields.story}/${e.fields.stop_id}`)).toEqual([
      'tour/intro',
      'job/intro',
    ]);
  });

  it('counts stops afresh for a new visit', () => {
    trackStoryStop('creation', 1, 9);
    configureAnalytics({ visitId: 'v2' });
    trackStoryStop('creation', 1, 9);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('sends story_exit with the stop, its number and how; story_return with the stop and how', () => {
    trackStoryExit('sinai', 4, 'fold');
    trackStoryReturn('flood', 'rejoin');
    expect(sent().map((e) => [e.event, e.fields])).toEqual([
      ['story_exit', { stop_id: 'sinai', stop_number: 4, how: 'fold', story: 'tour' }],
      ['story_return', { stop_id: 'flood', how: 'rejoin', story: 'tour' }],
    ]);
  });

  it('bands the zoom of a settled view', () => {
    trackViewSettled('Isaiah', 'neviim', 4);
    trackViewSettled('Isaiah', 'neviim', 0.5);
    expect(sent().map((e) => e.fields.zoom_band)).toEqual(['close', 'far']);
  });
});
