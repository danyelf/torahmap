import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { readLink } from '@torahmap/link';
import {
  arrivedWith,
  configureAnalytics,
  downloadKbps,
  reportError,
  reportUncaughtErrors,
  trackStoryExit,
  trackStoryReturn,
  trackPageView,
  trackSearchExecute,
  trackShare,
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

  it('sends the page view with what the link arrived with', () => {
    trackPageView('tour', 'intro', 'example.com', 'view', true);
    expect(sent()).toEqual([
      {
        event: 'page_view',
        visit: 'v1',
        mode: 'reader',
        fields: {
          story_stop: 'intro',
          referrer: 'example.com',
          story: 'tour',
          arrived_with: 'view',
          visited: 'yes',
        },
      },
    ]);
  });

  it('sends a share with how it went and what was shared', () => {
    trackShare({
      how: 'copied',
      what: 'view',
      story: '',
      stop_id: '',
      overlay: 'commentary',
      searching: 1,
      pinned: 0,
    });
    expect(sent()).toEqual([
      {
        event: 'share',
        visit: 'v1',
        mode: 'reader',
        fields: {
          how: 'copied',
          what: 'view',
          story: '',
          stop_id: '',
          overlay: 'commentary',
          searching: 1,
          pinned: 0,
        },
      },
    ]);
  });
});

describe('arrivedWith', () => {
  it('names a view for a verse link on an ordinary navigation', () => {
    expect(arrivedWith(readLink('?verse=Genesis.1.1'), 'navigate')).toBe('view');
  });

  it('names a stop for a story link', () => {
    expect(arrivedWith(readLink('?story=tour&stop=intro'), 'navigate')).toBe('stop');
  });

  it('names nothing for a bare link', () => {
    expect(arrivedWith(readLink(''), 'navigate')).toBe('nothing');
  });

  it('names nothing for any link on a reload or Back/Forward', () => {
    expect(arrivedWith(readLink('?verse=Genesis.1.1'), 'reload')).toBe('nothing');
    expect(arrivedWith(readLink('?story=tour&stop=intro'), 'back_forward')).toBe('nothing');
  });
});

describe('errors', () => {
  let consoleError: MockInstance<typeof console.error>;
  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => consoleError.mockRestore());

  it('logs a handled error and sends it with where it came from', () => {
    reportError('loadJson', new TypeError('Failed to fetch'));
    expect(consoleError).toHaveBeenCalled();
    expect(sent()).toEqual([
      {
        event: 'error',
        visit: 'v1',
        mode: 'reader',
        fields: { source: 'loadJson', message: 'TypeError: Failed to fetch' },
      },
    ]);
  });

  it('sends each distinct error once per visit', () => {
    reportError('layout', 'Book not found');
    reportError('layout', 'Book not found');
    reportError('layout', 'Another book not found');
    configureAnalytics({ visitId: 'v2' });
    reportError('layout', 'Book not found');
    expect(sent().map((e) => [e.visit, e.fields.message])).toEqual([
      ['v1', 'Book not found'],
      ['v1', 'Another book not found'],
      ['v2', 'Book not found'],
    ]);
  });

  it('cuts a long message short', () => {
    reportError('layout', 'x'.repeat(500));
    expect(sent()[0].fields.message.length).toBeLessThan(500);
  });

  it('logs the error itself after its context, and sends both as text', () => {
    const error = new SyntaxError('Unexpected token');
    reportError('loadJson', error, 'Failed to load the commentary counts');
    expect(consoleError).toHaveBeenCalledWith(
      'loadJson: Failed to load the commentary counts:',
      error,
    );
    expect(sent()[0].fields.message).toBe(
      'Failed to load the commentary counts: SyntaxError: Unexpected token',
    );
  });

  it('reports uncaught errors and rejections without logging them again', () => {
    const target = new EventTarget() as Window;
    reportUncaughtErrors(target);
    target.dispatchEvent(Object.assign(new Event('error'), { error: new Error('thrown') }));
    target.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: 'refused' }));
    expect(sent().map((e) => e.fields)).toEqual([
      { source: 'uncaught', message: 'Error: thrown' },
      { source: 'unhandled_rejection', message: 'refused' },
    ]);
    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe('downloadKbps', () => {
  it('is the bits transferred over the time the body took, per millisecond', () => {
    // 250,000 bytes in 500 ms: 2,000,000 bits / 500 ms = 4000 kbps.
    expect(downloadKbps({ transferSize: 250_000, responseStart: 100, responseEnd: 600 })).toBe(
      4000,
    );
  });

  it('is 0 where the browser reported no download', () => {
    expect(downloadKbps(undefined)).toBe(0);
    expect(downloadKbps({ transferSize: 0, responseStart: 100, responseEnd: 600 })).toBe(0);
    expect(downloadKbps({ transferSize: 250_000, responseStart: 100, responseEnd: 100 })).toBe(0);
  });
});
